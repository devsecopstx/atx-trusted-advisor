package com.atxfinance.backend.web

import com.atxfinance.backend.admin.AdminPortfolioAccountsService
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

@RestController
class AdminPortfolioAccountsController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val adminPortfolioAccountsService: AdminPortfolioAccountsService,
) {

    @GetMapping("/api/admin/portfolios/{portfolioId}/accounts")
    fun list(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
    ): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        if (!ObjectId.isValid(portfolioId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid portfolio id"))
        }
        val data = adminPortfolioAccountsService.buildConsoleJson(portfolioId)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PostMapping("/api/admin/portfolios/{portfolioId}/accounts")
    fun create(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        if (!ObjectId.isValid(portfolioId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid portfolio id"))
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        val name = (body["name"] as? String)?.trim().orEmpty()
        if (name.isEmpty() || name.length > 200) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("error" to "Invalid request payload"),
            )
        }
        val type = body["type"] as? String
        val ext = body["extAccountId"] as? String
        val cash = (body["cashBalance"] as? Number)?.toDouble()
        val created =
            adminPortfolioAccountsService.insertAccount(portfolioId, name, type, ext, cash)
                ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Could not create account"))
        val portfolio = adminPortfolioAccountsService.findPortfolioById(portfolioId)
        val tenantHex =
            when (val t = portfolio?.get("tenantId")) {
                is ObjectId -> t.toHexString()
                is String -> t.takeIf { ObjectId.isValid(it) }
                else -> null
            }
        val data = adminPortfolioAccountsService.toAdminAccountJson(created, portfolioId, tenantHex)
        return ResponseEntity.status(HttpStatus.CREATED).body(mapOf("data" to data))
    }

    @PatchMapping("/api/admin/portfolios/{portfolioId}/accounts/{accountId}")
    fun patch(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @PathVariable accountId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        if (!atLeastOnePatchField(body)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        }
        val name = body["name"] as? String
        val cash = (body["cashBalance"] as? Number)?.toDouble()
        val ext = body["extAccountId"] as? String
        val type = body["type"] as? String
        val isDefault = body["isDefault"] as? Boolean
        val riskPresent = body.containsKey("riskProfile")
        val outlookPresent = body.containsKey("outlook")
        val updated =
            adminPortfolioAccountsService.patchAccount(
                portfolioId = portfolioId,
                accountId = accountId,
                name = name,
                cashBalance = cash,
                extAccountId = ext,
                type = type,
                isDefault = isDefault,
                riskProfile = body["riskProfile"],
                riskProfilePresent = riskPresent,
                outlook = body["outlook"],
                outlookPresent = outlookPresent,
            )
                ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Account not found"))
        val portfolio = adminPortfolioAccountsService.findPortfolioById(portfolioId)
        val tenantHex =
            when (val t = portfolio?.get("tenantId")) {
                is ObjectId -> t.toHexString()
                is String -> t.takeIf { ObjectId.isValid(it) }
                else -> null
            }
        val data = adminPortfolioAccountsService.toAdminAccountJson(updated, portfolioId, tenantHex)
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @DeleteMapping("/api/admin/portfolios/{portfolioId}/accounts/{accountId}")
    fun delete(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @PathVariable accountId: String,
    ): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        val ok = adminPortfolioAccountsService.deleteAccount(portfolioId, accountId)
        if (!ok) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("error" to "Cannot delete (not found, or last account in portfolio)"),
            )
        }
        return ResponseEntity.ok(mapOf("ok" to true))
    }

    private fun atLeastOnePatchField(body: Map<String, Any?>): Boolean {
        if ((body["cashBalance"] as? Number) != null) {
            return true
        }
        if (body["type"] != null) {
            return true
        }
        if (body["isDefault"] == true) {
            return true
        }
        if (body.containsKey("riskProfile") || body.containsKey("outlook")) {
            return true
        }
        val name = body["name"] as? String
        if (name != null && name.trim().isNotEmpty()) {
            return true
        }
        val ext = body["extAccountId"] as? String
        if (ext != null && ext.trim().isNotEmpty()) {
            return true
        }
        return false
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
