package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.canUserLogin
import com.atxfinance.backend.strategy.HotPicksOutcome
import com.atxfinance.backend.strategy.HotPicksService
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class HotPicksController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val hotPicksService: HotPicksService,
) {
    @GetMapping("/api/portfolios/hot-picks")
    fun hotPicks(
        request: HttpServletRequest,
        @RequestParam(required = false) scope: String?,
        @RequestParam(required = false) bias: String?,
        @RequestParam(required = false) portfolioId: String?,
        @RequestParam(required = false) minEdgeScore: Int?,
        @RequestParam(required = false) maxEdgeScore: Int?,
        @RequestParam(required = false) dteMin: Int?,
        @RequestParam(required = false) dteMax: Int?,
    ): ResponseEntity<Map<String, Any?>> {
        val session =
            sessionCookieParser.resolveSessionUser(
                request.getHeader("Cookie"),
                props.sessionCookieName,
            ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.canUserLogin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }

        return when (
            val outcome =
                hotPicksService.load(
                    session,
                    scope,
                    bias,
                    portfolioId,
                    minEdgeScore,
                    maxEdgeScore,
                    dteMin,
                    dteMax,
                )
        ) {
            is HotPicksOutcome.Ok -> ResponseEntity.ok(outcome.body)
            is HotPicksOutcome.BadRequest -> ResponseEntity.status(HttpStatus.BAD_REQUEST).body(outcome.body)
            is HotPicksOutcome.Unavailable -> ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(outcome.body)
        }
    }
}
