package com.atxfinance.backend.web

import com.atxfinance.backend.admin.AdminPortfolioPositionsService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PositionValidationException
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.isGlobalAdmin
import jakarta.servlet.http.HttpServletRequest
import org.bson.types.ObjectId
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class AdminPortfolioPositionsController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val adminPortfolioPositionsService: AdminPortfolioPositionsService,
) {

    @GetMapping("/api/admin/portfolios/{portfolioId}/accounts/{accountId}/positions")
    fun list(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @PathVariable accountId: String,
    ): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(accountId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid id"))
        }
        val body = adminPortfolioPositionsService.listBundleJson(portfolioId, accountId)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                mapOf("error" to "Portfolio or account not found"),
            )
        return ResponseEntity.ok(body)
    }

    @PostMapping("/api/admin/portfolios/{portfolioId}/accounts/{accountId}/positions")
    fun create(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @PathVariable accountId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val g = adminGate(request)
        if (g is AdminGate.Err) {
            return g.response
        }
        g as AdminGate.Ok
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(accountId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid id"))
        }
        return try {
            val data =
                adminPortfolioPositionsService.upsertFromBodyReturningApiShape(
                    g.session,
                    portfolioId,
                    accountId,
                    body,
                )
            ResponseEntity.status(HttpStatus.CREATED).body(mapOf("data" to data))
        } catch (e: PositionValidationException) {
            validationResponse(e)
        }
    }

    private fun validationResponse(e: PositionValidationException): ResponseEntity<Map<String, Any?>> {
        val status =
            when (e.code) {
                PositionValidationException.Code.ACCOUNT_NOT_FOUND,
                PositionValidationException.Code.ACCOUNT_PORTFOLIO_MISMATCH,
                -> HttpStatus.NOT_FOUND
                PositionValidationException.Code.INVALID_IDS,
                PositionValidationException.Code.ACCOUNT_MISSING_EXT_ACCOUNT_ID,
                PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                PositionValidationException.Code.INVALID_OPTION_EXPIRATION,
                -> HttpStatus.BAD_REQUEST
            }
        return ResponseEntity.status(status).body(
            mapOf(
                "error" to (e.message ?: ""),
                "code" to e.code.name,
            ),
        )
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
