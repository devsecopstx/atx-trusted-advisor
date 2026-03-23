package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.DefaultPortfolioApiService
import com.atxfinance.backend.session.SessionCookieParser
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class PortfoliosDefaultController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val defaultPortfolioApiService: DefaultPortfolioApiService,
) {

    @GetMapping("/api/portfolios/default")
    fun getDefault(request: HttpServletRequest): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))

        return ResponseEntity.ok(mapOf("data" to defaultPortfolioApiService.loadSummaryPayload(session)))
    }

    @PostMapping("/api/portfolios/default")
    fun postDefault(request: HttpServletRequest): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))

        return try {
            val data = defaultPortfolioApiService.loadSummaryPayload(session)
            ResponseEntity.ok(mapOf("data" to data, "synced" to true))
        } catch (_: Exception) {
            ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                mapOf("error" to "Could not sync your default portfolio. Please try again in a moment."),
            )
        }
    }

    @GetMapping("/api/portfolios/current")
    fun getCurrent(request: HttpServletRequest): ResponseEntity<Map<String, Any?>> = getDefault(request)
}
