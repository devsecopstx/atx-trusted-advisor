package com.atxfinance.backend.web

import com.atxfinance.backend.admin.AdminPortfolioWatchlistService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.isGlobalAdmin
import jakarta.servlet.http.HttpServletRequest
import org.bson.types.ObjectId
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class AdminPortfolioWatchlistController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val adminPortfolioWatchlistService: AdminPortfolioWatchlistService,
) {

    @GetMapping("/api/admin/portfolios/{portfolioId}/watchlist")
    fun get(
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
        val body = adminPortfolioWatchlistService.getOrEnsureWatchlistJson(portfolioId)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))
        return ResponseEntity.ok(body)
    }

    @PatchMapping("/api/admin/portfolios/{portfolioId}/watchlist")
    fun patch(
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
        val addSymbols = stringList(body["addSymbols"], 20)
        val addEntries = mapList(body["addEntries"], 20)
        val removeSymbols = stringList(body["removeSymbols"], 20)
        val dedupe = body["dedupe"] as? Boolean
        val riskPresent = body.containsKey("riskProfile")
        val outlookPresent = body.containsKey("outlook")

        return when (
            val r =
                adminPortfolioWatchlistService.patchWatchlist(
                    portfolioId = portfolioId,
                    addSymbols = addSymbols,
                    addEntries = addEntries,
                    removeSymbols = removeSymbols,
                    dedupe = dedupe,
                    riskProfile = body["riskProfile"],
                    riskProfilePresent = riskPresent,
                    outlook = body["outlook"],
                    outlookPresent = outlookPresent,
                )
        ) {
            is AdminPortfolioWatchlistService.PatchResult.Ok -> ResponseEntity.ok(r.body)
            is AdminPortfolioWatchlistService.PatchResult.BadRequest ->
                ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                    mapOf("error" to "Invalid payload", "details" to mapOf("message" to r.message)),
                )
            AdminPortfolioWatchlistService.PatchResult.NotFoundPortfolio ->
                ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))
            AdminPortfolioWatchlistService.PatchResult.NotFoundWatchlist ->
                ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Watchlist not found"))
        }
    }

    private fun stringList(raw: Any?, max: Int): List<String>? {
        val arr = raw as? List<*> ?: return null
        return arr.mapNotNull { (it as? String)?.trim()?.takeIf { s -> s.isNotEmpty() } }.take(max)
    }

    private fun mapList(raw: Any?, max: Int): List<Map<String, Any?>>? {
        val arr = raw as? List<*> ?: return null
        return arr.take(max).mapNotNull { item ->
            when (item) {
                is Map<*, *> -> item.entries.associate { (k, v) -> k.toString() to v }
                else -> null
            }
        }
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
