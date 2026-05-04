package com.atxfinance.backend.web

import com.atxfinance.backend.audit.AdminAuditQueryService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.isGlobalAdmin
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.time.format.DateTimeParseException

@RestController
class AdminAuditController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val adminAuditQueryService: AdminAuditQueryService,
) {

    private val allowedEntityTypes = setOf(
        "xpersona",
        "access_request",
        "core_user",
        "deploy_note_config",
        "admin_delivery_channel",
        "admin_portfolio",
        "xchat_session",
        "core_scanner",
        "rental_ai",
    )

    @GetMapping("/api/admin/audit")
    fun list(
        request: HttpServletRequest,
        @RequestParam(name = "entityType", required = false) entityType: String?,
        @RequestParam(name = "entityId", required = false) entityId: String?,
        @RequestParam(name = "action", required = false) action: String?,
        @RequestParam(name = "actor", required = false) actor: String?,
        @RequestParam(name = "from", required = false) fromRaw: String?,
        @RequestParam(name = "to", required = false) toRaw: String?,
        @RequestParam(name = "limit", required = false) limitRaw: String?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.isGlobalAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }
        if (entityType != null && entityType.isNotBlank() && entityType !in allowedEntityTypes) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid query payload"))
        }
        val limit = limitRaw?.toIntOrNull() ?: 200
        val from = parseInstant(fromRaw)
        val to = parseInstant(toRaw)
        if (fromRaw != null && fromRaw.isNotBlank() && from == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid query payload"))
        }
        if (toRaw != null && toRaw.isNotBlank() && to == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid query payload"))
        }
        val data = adminAuditQueryService.list(entityType, entityId, action, actor, from, to, limit)
        return ResponseEntity.ok(mapOf("data" to data))
    }

    private fun parseInstant(raw: String?): Instant? {
        if (raw.isNullOrBlank()) {
            return null
        }
        return try {
            Instant.parse(raw)
        } catch (_: DateTimeParseException) {
            null
        }
    }
}
