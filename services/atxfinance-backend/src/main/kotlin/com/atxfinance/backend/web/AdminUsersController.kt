package com.atxfinance.backend.web

import com.atxfinance.backend.admin.AdminUsersService
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
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class AdminUsersController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val adminUsersService: AdminUsersService,
) {

    @GetMapping("/api/admin/users")
    fun list(
        request: HttpServletRequest,
        @RequestParam(name = "limit", required = false, defaultValue = "100") limit: Int,
    ): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        val rows = adminUsersService.listUsers(limit)
        return ResponseEntity.ok(mapOf("data" to rows))
    }

    @PostMapping("/api/admin/users")
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
        val email = body["email"] as? String ?: return badUserPayload()
        val role = (body["role"] as? String)?.trim()?.lowercase() ?: "viewer"
        val subscriptionPlan = (body["subscriptionPlan"] as? String)?.trim()?.lowercase() ?: "free"
        val status = (body["status"] as? String)?.trim()?.lowercase() ?: "active"
        if (role !in setOf("global_admin", "advisor", "operator", "viewer")) {
            return badUserPayload()
        }
        if (subscriptionPlan !in setOf("free", "pro", "enterprise")) {
            return badUserPayload()
        }
        if (status !in setOf("active", "suspended")) {
            return badUserPayload()
        }
        if (email.isBlank()) {
            return badUserPayload()
        }
        return try {
            val data = adminUsersService.createUser(session, email, role, subscriptionPlan, status)
            ResponseEntity.status(HttpStatus.CREATED).body(data)
        } catch (_: AdminUsersService.DuplicateEmailException) {
            ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf("error" to "A user with this email already exists"))
        }
    }

    @GetMapping("/api/admin/users/approved")
    fun listApproved(
        request: HttpServletRequest,
        @RequestParam(name = "limit", required = false, defaultValue = "100") limit: Int,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        val data = adminUsersService.listApproved(session, limit)
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @GetMapping("/api/admin/users/{userId}")
    fun getOne(
        request: HttpServletRequest,
        @PathVariable userId: String,
    ): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        if (!ObjectId.isValid(userId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid user id"))
        }
        val data = adminUsersService.getUser(userId)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "User not found"))
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PutMapping("/api/admin/users/{userId}")
    fun update(
        request: HttpServletRequest,
        @PathVariable userId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (!ObjectId.isValid(userId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid user id"))
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON"))
        }
        val email = body["email"] as? String
        val role = (body["role"] as? String)?.trim()?.lowercase()
        val subscriptionPlan = (body["subscriptionPlan"] as? String)?.trim()?.lowercase()
        val status = (body["status"] as? String)?.trim()?.lowercase()
        if (email == null && role == null && subscriptionPlan == null && status == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("error" to "Invalid user payload", "message" to "Provide at least one field to update."),
            )
        }
        if (role != null && role !in setOf("global_admin", "advisor", "operator", "viewer")) {
            return badUserPayload()
        }
        if (subscriptionPlan != null && subscriptionPlan !in setOf("free", "pro", "enterprise")) {
            return badUserPayload()
        }
        if (status != null && status !in setOf("active", "suspended")) {
            return badUserPayload()
        }
        return try {
            val updated = adminUsersService.updateUser(session, userId, email, role, subscriptionPlan, status)
                ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "User not found"))
            ResponseEntity.ok(mapOf("data" to updated))
        } catch (_: AdminUsersService.DuplicateEmailException) {
            ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf("error" to "A user with this email already exists"))
        }
    }

    @DeleteMapping("/api/admin/users/{userId}")
    fun delete(
        request: HttpServletRequest,
        @PathVariable userId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (!ObjectId.isValid(userId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid user id"))
        }
        if (session.userId == userId) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(mapOf("error" to "Cannot delete your own account from this console"))
        }
        val ok = adminUsersService.deleteUser(session, userId)
        if (!ok) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "User not found"))
        }
        return ResponseEntity.ok(mapOf("data" to mapOf("deleted" to true, "userId" to userId)))
    }

    @PatchMapping("/api/admin/users/{userId}/role")
    fun patchRole(
        request: HttpServletRequest,
        @PathVariable userId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (!ObjectId.isValid(userId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid user id"))
        }
        val role = (body?.get("role") as? String)?.trim()?.lowercase()
            ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        if (role !in setOf("global_admin", "advisor", "operator", "viewer")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        }
        val data = adminUsersService.patchRole(session, userId, role)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "User not found"))
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PatchMapping("/api/admin/users/{userId}/plan")
    fun patchPlan(
        request: HttpServletRequest,
        @PathVariable userId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (!ObjectId.isValid(userId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid user id"))
        }
        val plan = (body?.get("subscriptionPlan") as? String)?.trim()?.lowercase()
            ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        if (plan !in setOf("free", "pro", "enterprise")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        }
        val data = adminUsersService.patchPlan(session, userId, plan)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "User not found"))
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PatchMapping("/api/admin/users/{userId}/email")
    fun patchEmail(
        request: HttpServletRequest,
        @PathVariable userId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (!ObjectId.isValid(userId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid user id"))
        }
        val email = body?.get("email") as? String
            ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        if (email.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        }
        return try {
            val data = adminUsersService.patchEmail(session, userId, email)
                ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "User not found"))
            ResponseEntity.ok(mapOf("data" to data))
        } catch (_: AdminUsersService.DuplicateEmailException) {
            ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf("error" to "A user with this email already exists"))
        }
    }

    @GetMapping("/api/admin/users/{userId}/settings")
    fun getSettings(
        request: HttpServletRequest,
        @PathVariable userId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (!ObjectId.isValid(userId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid user id"))
        }
        val result = adminUsersService.getSettings(session, userId)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "User settings not found"))
        val (settings, linked) = result
        return ResponseEntity.ok(
            mapOf(
                "data" to settings,
                "metadata" to mapOf("linkedCollections" to linked),
            ),
        )
    }

    @PutMapping("/api/admin/users/{userId}/settings")
    fun putSettings(
        request: HttpServletRequest,
        @PathVariable userId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON"))
        }
        return when (val r = adminUsersService.putSettings(session, userId, body)) {
            is AdminUsersService.SettingsPutResult.Ok -> ResponseEntity.ok(mapOf("data" to r.data))
            is AdminUsersService.SettingsPutResult.BadRequest -> ResponseEntity.status(HttpStatus.BAD_REQUEST).body(r.body)
            is AdminUsersService.SettingsPutResult.NotFound -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(r.body)
            AdminUsersService.SettingsPutResult.PersonaNotFound ->
                ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                    mapOf("error" to "Assigned persona not found", "code" to "assigned_persona_not_found"),
                )
            AdminUsersService.SettingsPutResult.PersonaNotPublished ->
                ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                    mapOf("error" to "Assigned persona must be published", "code" to "assigned_persona_not_published"),
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

    private fun badUserPayload(): ResponseEntity<Map<String, Any?>> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid user payload"))
}
