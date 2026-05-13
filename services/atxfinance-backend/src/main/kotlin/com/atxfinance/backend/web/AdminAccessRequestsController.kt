package com.atxfinance.backend.web

import com.atxfinance.backend.admin.AdminAccessRequestService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.BsonJson
import com.atxfinance.backend.session.ResolvedSession
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.isGlobalAdmin
import jakarta.servlet.http.HttpServletRequest
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class AdminAccessRequestsController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val adminAccessRequestService: AdminAccessRequestService,
) {

    companion object {
        /** Align with Next.js `subscription-plan` / Mongo `core_users.subscriptionPlan`. */
        private val CANONICAL_SUBSCRIPTION_PLANS = setOf("basic", "premium", "premium_plus")
    }

    private fun normalizeSubscriptionPlanSlug(raw: String): String {
        val n = raw.trim().lowercase()
        return when (n) {
            "free" -> "basic"
            "pro", "premium_monthly" -> "premium"
            "enterprise", "premium+", "premium_plus_monthly", "premium_plus_yearly" -> "premium_plus"
            else -> n
        }
    }

    @GetMapping("/api/admin/access-requests")
    fun list(
        request: HttpServletRequest,
        @RequestParam(name = "status", required = false, defaultValue = "open") status: String,
    ): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        val raw = status.trim().ifEmpty { "open" }
        return try {
            val data = adminAccessRequestService.list(raw)
            ResponseEntity.ok(mapOf("data" to data))
        } catch (_: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid query payload"))
        }
    }

    @PostMapping("/api/admin/access-requests")
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
        val userId = body["userId"] as? String
        val email = body["email"] as? String
        val requestedRole = (body["requestedRole"] as? String)?.trim()?.lowercase()
            ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        val reason = (body["reason"] as? String) ?: ""
        val requestedPlanRaw = (body["requestedPlan"] as? String)?.trim()?.lowercase() ?: "basic"
        val requestedPlan = normalizeSubscriptionPlanSlug(requestedPlanRaw)
        val statusIn = (body["status"] as? String)?.trim()?.lowercase()
        if (requestedRole !in setOf("global_admin", "advisor", "operator", "viewer")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        }
        if (requestedPlan !in CANONICAL_SUBSCRIPTION_PLANS) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        }
        return try {
            val (doc, meta) = adminAccessRequestService.createAdmin(
                session = session,
                userIdInput = userId,
                emailInput = email,
                requestedRole = requestedRole,
                reason = reason,
                requestedPlan = requestedPlan,
                statusInput = statusIn,
            )
            ResponseEntity.status(HttpStatus.CREATED).body(
                mapOf(
                    "data" to serializeAccessRequest(doc),
                    "meta" to meta,
                ),
            )
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("error" to "Invalid request payload", "details" to mapOf("message" to (e.message ?: ""))),
            )
        } catch (e: AdminAccessRequestService.AccessRequestConflictException) {
            ResponseEntity.status(HttpStatus.CONFLICT).body(
                mapOf(
                    "error" to "A pending request for this user and role already exists.",
                    "data" to e.data,
                ),
            )
        } catch (_: IllegalStateException) {
            ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                mapOf("error" to "Unable to create or resolve user for access request"),
            )
        }
    }

    @GetMapping("/api/admin/access-requests/{requestId}")
    fun getOne(
        request: HttpServletRequest,
        @PathVariable requestId: String,
    ): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        val pair = adminAccessRequestService.getById(requestId) ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
            mapOf("error" to "Access request not found"),
        )
        val (doc, trail) = pair
        val data = serializeAccessRequest(doc).toMutableMap()
        data["auditTrail"] = trail
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PatchMapping("/api/admin/access-requests/{requestId}")
    fun patch(
        request: HttpServletRequest,
        @PathVariable requestId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> = update(request, requestId, body)

    @PutMapping("/api/admin/access-requests/{requestId}")
    fun put(
        request: HttpServletRequest,
        @PathVariable requestId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> = update(request, requestId, body)

    private fun update(
        request: HttpServletRequest,
        requestId: String,
        body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON"))
        }
        return when (val result = adminAccessRequestService.applyCompositeUpdate(session, requestId, body)) {
            is AdminAccessRequestService.ReviewResult.Ok -> ResponseEntity.ok(mapOf("data" to result.data))
            is AdminAccessRequestService.ReviewResult.Error -> ResponseEntity.status(result.status).body(result.body)
        }
    }

    @DeleteMapping("/api/admin/access-requests/{requestId}")
    fun delete(
        request: HttpServletRequest,
        @PathVariable requestId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (!ObjectId.isValid(requestId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid access request id"))
        }
        val ok = adminAccessRequestService.deleteById(session, requestId)
        if (!ok) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Access request not found"))
        }
        return ResponseEntity.ok(mapOf("data" to mapOf("deleted" to true, "requestId" to requestId)))
    }

    private sealed class AdminGate {
        data class Ok(val session: ResolvedSession) : AdminGate()
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

    private fun serializeAccessRequest(doc: Document): Map<String, Any?> {
        val m = BsonJson.documentToMap(doc).toMutableMap()
        m["_id"] = doc.getObjectId("_id")?.toHexString()
        m["tenantId"] = doc["tenantId"]?.let { BsonJson.value(it) }
        m["requestedAt"] = doc.getDate("requestedAt")?.toInstant()?.toString()
        m["reviewedAt"] = doc.getDate("reviewedAt")?.toInstant()?.toString()
        return m
    }
}
