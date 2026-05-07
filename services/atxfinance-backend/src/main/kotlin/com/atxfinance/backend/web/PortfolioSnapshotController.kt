package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PortfolioStructuredSummary
import com.atxfinance.backend.portfolio.PortfolioSnapshotService
import com.atxfinance.backend.session.SessionCookieParser
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class PortfolioSnapshotController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val portfolioSnapshotService: PortfolioSnapshotService,
) {
    /**
     * Redis-cached read of materialized workspace preload (Mongo `portfolio_workspace_snapshots`).
     * Response mirrors [PortfolioWorkspaceSnapshotController] with **`cache`** plus optional **`structured`**
     * (holdings summary, account balances, watchlist quote strip, `lastUpdated`).
     */
    @GetMapping("/api/portfolios/{portfolioId}/snapshot")
    fun getPortfolioSnapshot(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @RequestParam(name = "workspaceContentRev", defaultValue = "0") workspaceContentRev: Int,
    ): ResponseEntity<Map<String, Any?>> {
        val session =
            sessionCookieParser.resolveSessionUser(
                request.getHeader("Cookie"),
                props.sessionCookieName,
            ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))

        val t0 = System.nanoTime()
        val pair =
            portfolioSnapshotService.getCachedWorkspaceSnapshot(portfolioId, workspaceContentRev, session)
                ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "snapshot_not_found"))

        val (payload, cacheMeta) = pair
        val redisState = cacheMeta["redis"]?.toString().orEmpty()
        val headers = HttpHeaders()
        headers.add("X-Atx-Snapshot-Cache", redisState)
        val handlerMs = (System.nanoTime() - t0) / 1_000_000L
        headers.add("X-Atx-Snapshot-Handler-Ms", handlerMs.toString())

        val data = LinkedHashMap<String, Any?>(payload.size + 2)
        data.putAll(payload)
        PortfolioStructuredSummary.fromWorkspacePayload(payload)?.let { data["structured"] = it }
        data["cache"] = cacheMeta
        return ResponseEntity.ok().headers(headers).body(mapOf("data" to data))
    }
}
