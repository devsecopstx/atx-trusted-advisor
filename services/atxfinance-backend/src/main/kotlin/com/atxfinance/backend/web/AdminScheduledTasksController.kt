package com.atxfinance.backend.web

import com.atxfinance.backend.admin.AdminScheduledTasksService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.isGlobalAdmin
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.Date

@RestController
class AdminScheduledTasksController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val adminScheduledTasksService: AdminScheduledTasksService,
) {

    @GetMapping("/api/admin/tasks")
    fun listTasks(
        request: HttpServletRequest,
        @RequestParam(name = "limit", required = false, defaultValue = "50") limit: Int,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val data = adminScheduledTasksService.listTasks(session, limit)
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PostMapping("/api/admin/tasks")
    fun createTask(
        request: HttpServletRequest,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON"))
        }
        return try {
            val result = adminScheduledTasksService.createTask(session, body)
            ResponseEntity.status(HttpStatus.CREATED).body(result)
        } catch (_: AdminScheduledTasksService.BadTaskPayloadException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        }
    }

    @PatchMapping("/api/admin/tasks/{taskId}")
    fun patchTask(
        request: HttpServletRequest,
        @PathVariable taskId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON"))
        }
        return try {
            val result = adminScheduledTasksService.patchTenantLevelTask(session, taskId, body)
                ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Task not found"))
            ResponseEntity.ok(result)
        } catch (_: AdminScheduledTasksService.BadTaskPayloadException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        }
    }

    @DeleteMapping("/api/admin/tasks/{taskId}")
    fun deleteTask(
        request: HttpServletRequest,
        @PathVariable taskId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val ok = adminScheduledTasksService.deleteTenantLevelTask(session, taskId)
        if (!ok) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Task not found"))
        }
        return ResponseEntity.ok(mapOf("ok" to true))
    }

    @PostMapping("/api/admin/tasks/{taskId}/run")
    fun runTask(
        request: HttpServletRequest,
        @PathVariable taskId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val task = adminScheduledTasksService.getTaskForTenant(taskId, session)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Task not found"))
        val username = session.username?.takeIf { it.isNotBlank() } ?: session.userId
        val exec = adminScheduledTasksService.enqueueScheduledTask(task, username)
        return ResponseEntity.ok(
            mapOf(
                "data" to mapOf(
                    "runId" to exec.runIdHex,
                    "status" to exec.status,
                    "output" to exec.output,
                ),
            ),
        )
    }

    @GetMapping("/api/admin/task-runs")
    fun listTaskRuns(
        request: HttpServletRequest,
        @RequestParam(name = "limit", required = false, defaultValue = "50") limit: Int,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val data = adminScheduledTasksService.listTaskRuns(session, limit)
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PostMapping("/api/admin/scheduler/tick")
    fun schedulerTick(
        request: HttpServletRequest,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val accepted = adminScheduledTasksService.enqueueDueTasks(Date(), session)
        val results = accepted.map { exec ->
            mapOf(
                "runId" to exec.runIdHex,
                "status" to exec.status,
                "output" to exec.output,
            )
        }
        return ResponseEntity.ok(
            mapOf(
                "data" to mapOf(
                    "processed" to results.size,
                    "results" to results,
                ),
            ),
        )
    }

    private sealed class AdminGate {
        data class Ok(val session: com.atxfinance.backend.session.ResolvedSession) : AdminGate()
        data class Err(val response: ResponseEntity<Map<String, Any?>>) : AdminGate()
    }

    private fun adminGate(request: HttpServletRequest): AdminGate {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return AdminGate.Err(
            ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized")),
        )
        if (!session.isGlobalAdmin()) {
            return AdminGate.Err(
                ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden")),
            )
        }
        return AdminGate.Ok(session)
    }
}
