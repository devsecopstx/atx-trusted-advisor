package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.DefaultPortfolioApiService
import com.atxfinance.backend.portfolio.PortfolioSnapshotService
import com.atxfinance.backend.portfolio.PortfolioStructuredSummary
import com.atxfinance.backend.session.SessionCookieParser
import jakarta.servlet.http.HttpServletRequest
import org.bson.types.ObjectId
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * Lightweight **read facade**: one round-trip for default portfolio + optional cached workspace snapshot
 * (Redis + Mongo), for high-frequency shell pages (`/xchat`, `/watchlist`, `/portfolio`, `/xoptions`).
 *
 * Timing headers (wall ms, JVM handler only — not browser RTT): **`X-Atx-Read-Facade-Total-Ms`**,
 * **`X-Atx-Read-Facade-Default-Ms`**, **`X-Atx-Read-Facade-Snapshot-Ms`** (0 when snapshot skipped or missing row).
 */
@RestController
class ReadFacadeController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val defaultPortfolioApiService: DefaultPortfolioApiService,
    private val portfolioSnapshotService: PortfolioSnapshotService,
) {
    @GetMapping("/api/read/product-shell-v1")
    fun getProductShellReadFacade(
        request: HttpServletRequest,
        @RequestParam(name = "workspaceContentRev", defaultValue = "0") workspaceContentRev: Int,
        @RequestParam(name = "includeSnapshot", defaultValue = "true") includeSnapshot: Boolean,
    ): ResponseEntity<Map<String, Any?>> {
        val session =
            sessionCookieParser.resolveSessionUser(
                request.getHeader("Cookie"),
                props.sessionCookieName,
            ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))

        if (workspaceContentRev < 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid workspaceContentRev"))
        }

        val tTotal0 = System.nanoTime()
        val tDefault0 = System.nanoTime()
        val defaultPortfolio = defaultPortfolioApiService.loadSummaryPayload(session)
        val defaultMs = (System.nanoTime() - tDefault0) / 1_000_000L

        val portfolioId = defaultPortfolio["_id"] as? String
        if (portfolioId.isNullOrBlank() || !ObjectId.isValid(portfolioId)) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(mapOf("error" to "default_portfolio_missing_id"))
        }

        var snapshotMs = 0L
        var workspaceSnapshot: Map<String, Any?>? = null
        if (includeSnapshot) {
            val tSnap0 = System.nanoTime()
            val pair = portfolioSnapshotService.getCachedWorkspaceSnapshot(portfolioId, workspaceContentRev, session)
            snapshotMs = (System.nanoTime() - tSnap0) / 1_000_000L
            if (pair != null) {
                val (payload, cacheMeta) = pair
                val merged = LinkedHashMap<String, Any?>(payload.size + 2)
                merged.putAll(payload)
                PortfolioStructuredSummary.fromWorkspacePayload(payload)?.let { merged["structured"] = it }
                merged["cache"] = cacheMeta
                workspaceSnapshot = merged
            }
        }

        val totalMs = (System.nanoTime() - tTotal0) / 1_000_000L
        val headers = HttpHeaders()
        headers.add("X-Atx-Read-Facade-Total-Ms", totalMs.toString())
        headers.add("X-Atx-Read-Facade-Default-Ms", defaultMs.toString())
        headers.add("X-Atx-Read-Facade-Snapshot-Ms", snapshotMs.toString())

        val data =
            mapOf(
                "facadeVersion" to 1,
                "defaultPortfolio" to defaultPortfolio,
                "workspaceSnapshot" to workspaceSnapshot,
            )

        return ResponseEntity.ok().headers(headers).body(mapOf("data" to data))
    }
}
