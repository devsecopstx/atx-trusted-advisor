package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.canUserLogin
import com.atxfinance.backend.strategy.GenerateStrategyRecommendationsRequest
import com.atxfinance.backend.strategy.StrategyRecommendationGenerateOutcome
import com.atxfinance.backend.strategy.StrategyRecommendationService
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class StrategyRecommendationsController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val strategyRecommendationService: StrategyRecommendationService,
) {
    @PostMapping("/api/strategy-recommendations/generate")
    fun generate(
        request: HttpServletRequest,
        @RequestBody(required = false) body: GenerateStrategyRecommendationsRequest?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.canUserLogin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }

        return when (val outcome = strategyRecommendationService.generate(session, body)) {
            is StrategyRecommendationGenerateOutcome.Ok -> ResponseEntity.ok(outcome.body)
            is StrategyRecommendationGenerateOutcome.BadRequest -> {
                ResponseEntity.status(HttpStatus.BAD_REQUEST).body(outcome.body)
            }
            is StrategyRecommendationGenerateOutcome.Unavailable -> {
                ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(outcome.body)
            }
        }
    }
}
