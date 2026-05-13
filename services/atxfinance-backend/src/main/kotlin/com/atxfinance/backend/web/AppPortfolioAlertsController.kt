package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.AppPortfolioAlertsService
import com.atxfinance.backend.session.SessionCookieParser
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

@RestController
class AppPortfolioAlertsController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val appPortfolioAlertsService: AppPortfolioAlertsService,
) {

    @PostMapping("/api/portfolios/{portfolioId}/alerts")
    fun create(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session =
            sessionCookieParser.resolveSessionUser(
                request.getHeader("Cookie"),
                props.sessionCookieName,
            ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        return try {
            val doc = appPortfolioAlertsService.createForAppUser(session, portfolioId, body)
            ResponseEntity.status(HttpStatus.CREATED).body(mapOf("data" to appPortfolioAlertsService.toAppUserJson(doc)))
        } catch (ex: ResponseStatusException) {
            ResponseEntity.status(ex.statusCode)
                .body(mapOf("error" to (ex.reason ?: ex.message ?: "Request failed")))
        }
    }
}
