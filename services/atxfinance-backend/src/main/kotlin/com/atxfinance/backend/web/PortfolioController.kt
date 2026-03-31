package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PortfolioCrudService
import com.atxfinance.backend.session.SessionCookieParser
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
class PortfolioController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val portfolioCrudService: PortfolioCrudService,
) {

    @PostMapping("/api/portfolios")
    fun postPortfolio(
        request: HttpServletRequest,
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
        val created = portfolioCrudService.createPortfolioForSessionUser(session, body)
            ?: return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                mapOf("error" to "Could not create portfolio (limit reached or invalid data)"),
            )
        val data = portfolioCrudService.buildSummaryPayload(created, session)
        return ResponseEntity.status(HttpStatus.CREATED).body(mapOf("data" to data))
    }

    @DeleteMapping("/api/portfolios/{portfolioId}")
    fun deletePortfolio(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session =
            sessionCookieParser.resolveSessionUser(
                request.getHeader("Cookie"),
                props.sessionCookieName,
            ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))

        if (!ObjectId.isValid(portfolioId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid portfolio id"))
        }

        return when (portfolioCrudService.deletePortfolioForSessionUser(portfolioId, session)) {
            is PortfolioCrudService.DeleteSessionPortfolioResult.Ok ->
                ResponseEntity.ok(mapOf("ok" to true))
            is PortfolioCrudService.DeleteSessionPortfolioResult.LastPortfolio ->
                ResponseEntity.status(HttpStatus.CONFLICT).body(
                    mapOf("error" to "Cannot delete your only portfolio. Create another portfolio first."),
                )
            is PortfolioCrudService.DeleteSessionPortfolioResult.NotFound ->
                ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))
        }
    }

    @GetMapping("/api/portfolios/{portfolioId}")
    fun getPortfolio(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))

        if (!ObjectId.isValid(portfolioId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid portfolio id"))
        }

        val portfolio = portfolioCrudService.findPortfolioForSessionUser(portfolioId, session)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))

        val data = portfolioCrudService.buildSummaryPayload(portfolio, session)
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PatchMapping("/api/portfolios/{portfolioId}")
    fun patchPortfolio(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))

        if (!ObjectId.isValid(portfolioId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid portfolio id"))
        }

        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        val nameRaw = body["name"]
        if (nameRaw !is String) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("error" to "Invalid request payload"),
            )
        }
        val trimmed = nameRaw.trim()
        if (trimmed.isEmpty() || trimmed.length > 200) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("error" to "Invalid request payload"),
            )
        }

        val existing = portfolioCrudService.findPortfolioForSessionUser(portfolioId, session)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))

        val updated = portfolioCrudService.updatePortfolioName(existing, nameRaw)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))

        val data = portfolioCrudService.buildSummaryPayload(updated, session)
        return ResponseEntity.ok(mapOf("data" to data))
    }
}
