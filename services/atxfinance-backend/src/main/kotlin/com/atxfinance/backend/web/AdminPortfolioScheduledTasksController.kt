package com.atxfinance.backend.web

import com.atxfinance.backend.admin.AdminPortfolioScheduledTasksService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.isGlobalAdmin
import jakarta.servlet.http.HttpServletRequest
import org.bson.types.ObjectId
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

/** Portfolio-scoped scheduled tasks (distinct from tenant-level `/api/admin/tasks`). */
@RestController
class AdminPortfolioScheduledTasksController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val adminPortfolioScheduledTasksService: AdminPortfolioScheduledTasksService,
) {

    @GetMapping("/api/admin/portfolios/{portfolioId}/tasks")
    fun list(request: HttpServletRequest, @PathVariable portfolioId: String): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val rows = adminPortfolioScheduledTasksService.list(session, portfolioId)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))
        return ResponseEntity.ok(mapOf("data" to rows))
    }

    @PostMapping("/api/admin/portfolios/{portfolioId}/tasks")
    fun create(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        val doc = adminPortfolioScheduledTasksService.create(session, portfolioId, body)
        if (doc == null || doc.getObjectId("_id") == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(
            mapOf("data" to adminPortfolioScheduledTasksService.toJson(doc)),
        )
    }

    @PatchMapping("/api/admin/portfolios/{portfolioId}/tasks/{taskId}")
    fun patch(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @PathVariable taskId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        val updated = adminPortfolioScheduledTasksService.patch(session, portfolioId, taskId, body)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Task not found"))
        return ResponseEntity.ok(mapOf("data" to adminPortfolioScheduledTasksService.toJson(updated)))
    }

    @DeleteMapping("/api/admin/portfolios/{portfolioId}/tasks/{taskId}")
    fun delete(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @PathVariable taskId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val ok = adminPortfolioScheduledTasksService.delete(session, portfolioId, taskId)
        if (!ok) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Task not found"))
        }
        return ResponseEntity.ok(mapOf("ok" to true))
    }

    private sealed class AdminGate {
        data class Ok(val session: com.atxfinance.backend.session.ResolvedSession) : AdminGate()
        data class Err(val response: ResponseEntity<Map<String, Any?>>) : AdminGate()
    }

    private fun adminGate(request: HttpServletRequest): AdminGate {
        val session =
            sessionCookieParser.resolveSessionUser(
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
