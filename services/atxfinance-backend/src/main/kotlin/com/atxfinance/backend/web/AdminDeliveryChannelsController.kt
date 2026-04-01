package com.atxfinance.backend.web

import com.atxfinance.backend.admin.AdminDeliveryChannelsService
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
import org.springframework.web.bind.annotation.RestController

@RestController
class AdminDeliveryChannelsController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val service: AdminDeliveryChannelsService,
) {

    @GetMapping("/api/admin/delivery-channels")
    fun list(request: HttpServletRequest): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val data = service.list(session)
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PostMapping("/api/admin/delivery-channels")
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
        } catch (e: AdminDeliveryChannelsService.BadPayloadException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to (e.message ?: "Invalid payload")))
        }
    }

    @GetMapping("/api/admin/delivery-channels/{channelId}")
    fun getById(
        request: HttpServletRequest,
        @PathVariable channelId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val data = service.getById(channelId, session)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Delivery channel not found"))
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PatchMapping("/api/admin/delivery-channels/{channelId}")
    fun patch(
        request: HttpServletRequest,
        @PathVariable channelId: String,
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
            val data = service.update(channelId, session, body)
                ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Delivery channel not found"))
            ResponseEntity.ok(mapOf("data" to data))
        } catch (e: AdminDeliveryChannelsService.BadPayloadException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to (e.message ?: "Invalid payload")))
        }
    }

    @DeleteMapping("/api/admin/delivery-channels/{channelId}")
    fun delete(
        request: HttpServletRequest,
        @PathVariable channelId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val deleted = service.delete(channelId, session)
        if (!deleted) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Delivery channel not found"))
        }
        return ResponseEntity.ok(mapOf("ok" to true))
    }

    @PostMapping("/api/admin/delivery-channels/{channelId}/test")
    fun test(
        request: HttpServletRequest,
        @PathVariable channelId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        return when (val r = service.test(channelId, session)) {
            is AdminDeliveryChannelsService.TestResult.Ok -> ResponseEntity.ok(r.body)
            AdminDeliveryChannelsService.TestResult.NotFound ->
                ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Delivery channel not found"))
            is AdminDeliveryChannelsService.TestResult.BadRequest ->
                ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to r.message))
            AdminDeliveryChannelsService.TestResult.UpstreamError ->
                ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(
                    mapOf("error" to "Slack webhook test failed (check URL or Slack app configuration)"),
                )
        }
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
