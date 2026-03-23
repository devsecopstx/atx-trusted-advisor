package com.atxfinance.backend.web

import com.atxfinance.backend.admin.AdminDeployNoteConfigService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.isGlobalAdmin
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class AdminDeployNoteConfigController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val service: AdminDeployNoteConfigService,
) {

    @GetMapping("/api/admin/deploy-note-configs")
    fun list(
        request: HttpServletRequest,
        @RequestParam(name = "limit", required = false, defaultValue = "100") limit: Int,
        @RequestParam(name = "environment", required = false) environment: String?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val data = service.list(session, limit, environment)
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PostMapping("/api/admin/deploy-note-configs")
    fun create(
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
            val result = service.create(session, body)
            ResponseEntity.status(HttpStatus.CREATED).body(result)
        } catch (e: AdminDeployNoteConfigService.BadPayloadException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to (e.message ?: "Invalid payload")))
        }
    }

    @GetMapping("/api/admin/deploy-note-configs/{configId}")
    fun getById(
        request: HttpServletRequest,
        @PathVariable configId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val data = service.getById(configId, session)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Deploy note config not found"))
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PutMapping("/api/admin/deploy-note-configs/{configId}")
    fun update(
        request: HttpServletRequest,
        @PathVariable configId: String,
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
            val data = service.update(configId, session, body)
                ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Deploy note config not found"))
            ResponseEntity.ok(mapOf("data" to data))
        } catch (e: AdminDeployNoteConfigService.BadPayloadException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to (e.message ?: "Invalid payload")))
        }
    }

    @DeleteMapping("/api/admin/deploy-note-configs/{configId}")
    fun delete(
        request: HttpServletRequest,
        @PathVariable configId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val deleted = service.delete(configId, session)
        if (!deleted) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Deploy note config not found"))
        }
        return ResponseEntity.ok(mapOf("data" to mapOf("deleted" to true, "configId" to configId)))
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
