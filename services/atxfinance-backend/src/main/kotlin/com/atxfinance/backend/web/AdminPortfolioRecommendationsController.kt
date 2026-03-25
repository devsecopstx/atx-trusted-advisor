package com.atxfinance.backend.web

import com.atxfinance.backend.admin.AdminPortfolioAccountsService
import com.atxfinance.backend.admin.AdminPortfolioRecommendationsService
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
class AdminPortfolioRecommendationsController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val adminPortfolioAccountsService: AdminPortfolioAccountsService,
    private val adminPortfolioRecommendationsService: AdminPortfolioRecommendationsService,
) {

    @GetMapping("/api/admin/portfolios/{portfolioId}/recommendations")
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
        val rows = adminPortfolioRecommendationsService.list(portfolioId)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))
        return ResponseEntity.ok(mapOf("data" to rows))
    }

    @PostMapping("/api/admin/portfolios/{portfolioId}/recommendations")
    fun create(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        if (!ObjectId.isValid(portfolioId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid portfolio id"))
        }
        if (adminPortfolioAccountsService.findPortfolioById(portfolioId) == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))
        }
        val doc = adminPortfolioRecommendationsService.create(portfolioId, body)
        if (doc == null || doc.getObjectId("_id") == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Could not create recommendation"))
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(
            mapOf("data" to adminPortfolioRecommendationsService.toJson(doc)),
        )
    }

    @PatchMapping("/api/admin/portfolios/{portfolioId}/recommendations/{recommendationId}")
    fun patch(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @PathVariable recommendationId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        val updated = adminPortfolioRecommendationsService.patch(portfolioId, recommendationId, body)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Recommendation not found"))
        return ResponseEntity.ok(mapOf("data" to adminPortfolioRecommendationsService.toJson(updated)))
    }

    @DeleteMapping("/api/admin/portfolios/{portfolioId}/recommendations/{recommendationId}")
    fun delete(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @PathVariable recommendationId: String,
    ): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        val ok = adminPortfolioRecommendationsService.delete(portfolioId, recommendationId)
        if (!ok) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Recommendation not found"))
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
