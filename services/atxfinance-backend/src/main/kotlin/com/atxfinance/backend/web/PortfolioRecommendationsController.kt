package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.recommendation.PortfolioRecommendationService
import com.atxfinance.backend.session.SessionCookieParser
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class PortfolioRecommendationsController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val portfolioRecommendationService: PortfolioRecommendationService,
) {

    @GetMapping("/api/portfolios/{portfolioId}/recommendations")
    fun list(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        val data = portfolioRecommendationService.list(session, portfolioId)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PostMapping("/api/portfolios/{portfolioId}/recommendations")
    fun create(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        return try {
            val doc = portfolioRecommendationService.create(session, portfolioId, body)
                ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))
            if (doc.getObjectId("_id") == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Could not create recommendation"))
            }
            ResponseEntity.status(HttpStatus.CREATED).body(mapOf("data" to portfolioRecommendationService.rowMap(doc)))
        } catch (_: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid payload"))
        }
    }
}
