package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.persona.AccessRequestService
import com.atxfinance.backend.session.SessionCookieParser
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import java.util.Date

@RestController
class AccessRequestsController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val accessRequestService: AccessRequestService,
) {

    @PostMapping("/api/access-requests")
    fun postAccessRequest(
        request: HttpServletRequest,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))

        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON"))
        }
        val roleRaw = body["requestedRole"] as? String
        val requestedRole = when (roleRaw?.trim()?.lowercase()) {
            "advisor", "operator", "viewer" -> roleRaw.trim().lowercase()
            null, "" -> "viewer"
            else -> return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("error" to "Invalid request", "details" to mapOf("requestedRole" to "invalid")),
            )
        }
        val reason = (body["reason"] as? String)?.trim() ?: ""
        if (reason.length < 3 || reason.length > 500) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("error" to "Invalid request", "details" to mapOf("reason" to "invalid length")),
            )
        }

        val pending = accessRequestService.findPendingForUserAndRole(session, requestedRole)
        if (pending != null) {
            val ra = pending["requestedAt"]
            val requestedAt = when (ra) {
                is Date -> ra.toInstant().toString()
                else -> ""
            }
            return ResponseEntity.status(HttpStatus.CONFLICT).body(
                mapOf(
                    "error" to "You already have a pending access request.",
                    "data" to mapOf(
                        "requestedRole" to (pending["requestedRole"] ?: requestedRole),
                        "status" to (pending["status"] ?: "pending"),
                        "requestedAt" to requestedAt,
                    ),
                ),
            )
        }

        val created = accessRequestService.createSelfRequest(session, requestedRole, reason)
        val ra = created["requestedAt"]
        val requestedAt = when (ra) {
            is Date -> ra.toInstant().toString()
            else -> ""
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(
            mapOf(
                "ok" to true,
                "data" to mapOf(
                    "requestedRole" to created["requestedRole"],
                    "status" to created["status"],
                    "requestedAt" to requestedAt,
                ),
            ),
        )
    }
}
