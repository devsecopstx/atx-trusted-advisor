package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.canUserLogin
import com.atxfinance.backend.strategy.ProfitFinderOutcome
import com.atxfinance.backend.strategy.ProfitFinderScanRequest
import com.atxfinance.backend.strategy.ProfitFinderService
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class ProfitFinderController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val profitFinderService: ProfitFinderService,
) {
    @PostMapping("/api/profit-finder/scan")
    fun scan(
        request: HttpServletRequest,
        @RequestBody(required = false) body: ProfitFinderScanRequest?,
    ): ResponseEntity<Map<String, Any?>> {
        val session =
            sessionCookieParser.resolveSessionUser(
                request.getHeader("Cookie"),
                props.sessionCookieName,
            ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.canUserLogin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }

        return when (val outcome = profitFinderService.scan(session, body)) {
            is ProfitFinderOutcome.Ok -> ResponseEntity.ok(outcome.body)
            is ProfitFinderOutcome.BadRequest -> ResponseEntity.status(HttpStatus.BAD_REQUEST).body(outcome.body)
            is ProfitFinderOutcome.Unavailable -> ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(outcome.body)
        }
    }
}