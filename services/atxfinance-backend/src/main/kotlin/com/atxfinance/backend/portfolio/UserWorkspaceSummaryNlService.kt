package com.atxfinance.backend.portfolio

import com.atxfinance.backend.session.ResolvedSession
import com.atxfinance.backend.xchat.AtxFunctionExecutionContext
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs

/**
 * JVM parity for Next `user_workspace_summary` / NL workspace preflight JSON.
 *
 * **NL price alerts:** mutations and list payloads remain in [PortfolioPriceAlertNlService]; this service only
 * attaches [PortfolioPriceAlertNlService.nlPriceAlertPreflightSummary] for one-glance NL context.
 */
@Service
class UserWorkspaceSummaryNlService(
    private val portfolioCrudService: PortfolioCrudService,
    private val defaultPortfolioProvisionService: DefaultPortfolioProvisionService,
    private val positionsService: PositionsService,
    private val portfolioPriceAlertNlService: PortfolioPriceAlertNlService,
) {
    fun buildUserWorkspaceSummary(ctx: AtxFunctionExecutionContext): Map<String, Any?> {
        val session = ctx.session
        val portfolios = portfolioCrudService.listPortfoliosForSessionUser(session)
        if (portfolios.isEmpty()) {
            return mapOf("error" to "no_portfolios")
        }
        val active = resolveActivePortfolioDoc(session, ctx.portfolioIdHex)
        val activeId = active?.getObjectId("_id")?.toHexString().orEmpty()
        val activeName = active?.getString("name")?.trim().orEmpty().ifEmpty { "Workspace portfolio" }

        val rows = mutableListOf<Map<String, Any?>>()
        for (pf in portfolios.take(MAX_PORTFOLIOS)) {
            val pid = pf.getObjectId("_id")?.toHexString() ?: continue
            val accounts = portfolioCrudService.listAccountsForPortfolio(ObjectId(pid), session)
            val positions = mutableListOf<Document>()
            for (acc in accounts) {
                val aid = acc.getObjectId("_id")?.toHexString() ?: continue
                positions.addAll(positionsService.listPositionsForPortfolioAccount(session, pid, aid))
            }
            val acctRows =
                accounts.map { a ->
                    mapOf(
                        "name" to (a.getString("name")?.trim().orEmpty().ifEmpty { "Account" }),
                        "cashBalance" to cashBalanceOrDefault(a),
                        "isDefault" to (a.getBoolean("isDefault") == true),
                        "riskProfile" to a.getString("riskProfile"),
                    )
                }
            rows.add(
                mapOf(
                    "name" to (pf.getString("name")?.trim().orEmpty().ifEmpty { "Portfolio" }),
                    "id" to pid,
                    "holdings" to formatHoldingsSummaryFromPositions(positions),
                    "cash" to formatCashAcrossAccounts(acctRows),
                    "riskLevel" to mapRiskLevelFromAccounts(acctRows),
                ),
            )
        }

        val workspace =
            mutableMapOf<String, Any?>(
                "activePortfolio" to activeName,
                "activePortfolioId" to activeId,
                "portfolios" to rows,
            )
        if (activeId.isNotEmpty()) {
            workspace["nlPriceAlerts"] =
                portfolioPriceAlertNlService.nlPriceAlertPreflightSummary(session, activeId)
        }
        return mapOf("workspace" to workspace)
    }

    private fun resolveActivePortfolioDoc(
        session: ResolvedSession,
        hintHex: String?,
    ): Document? {
        val explicit = hintHex?.trim()?.takeIf { ObjectId.isValid(it) }
        if (explicit != null) {
            return portfolioCrudService.findPortfolioForSessionUser(explicit, session)
        }
        return defaultPortfolioProvisionService.getDefaultPortfolioDoc(session)
    }

    private fun cashBalanceOrDefault(account: Document): Double {
        val n = account["cashBalance"] as? Number
        if (n != null && n.toDouble().isFinite()) {
            return n.toDouble()
        }
        return DEFAULT_CASH
    }

    private fun formatCashAcrossAccounts(
        accounts: List<Map<String, Any?>>,
    ): String {
        if (accounts.isEmpty()) {
            return '$' + "0.00 (no accounts)"
        }
        val total = accounts.sumOf { ((it["cashBalance"] as? Number)?.toDouble() ?: 0.0) }
        val parts =
            accounts.take(5).map { a ->
                val nm = a["name"]?.toString()?.trim().orEmpty().ifEmpty { "Account" }
                val bal = (a["cashBalance"] as? Number)?.toDouble() ?: 0.0
                "$nm: ${formatUsd(bal)}"
            }
        val tail = if (accounts.size > 5) "; +${accounts.size - 5} more account(s)" else ""
        return "${formatUsd(total)} total (${parts.joinToString("; ")}$tail)"
    }

    private fun mapRiskLevelFromAccounts(accounts: List<Map<String, Any?>>): String? {
        val ordered = accounts.sortedByDescending { it["isDefault"] == true }
        val raw = ordered.firstOrNull { it["riskProfile"] != null }?.get("riskProfile")?.toString()?.trim()?.lowercase().orEmpty()
        return when (raw) {
            "conservative" -> "conservative"
            "balanced" -> "moderate"
            "growth" -> "aggressive"
            else -> null
        }
    }

    private fun formatHoldingsSummaryFromPositions(positions: List<Document>): String {
        if (positions.isEmpty()) {
            return "No positions recorded"
        }
        val sorted =
            positions.sortedByDescending { p ->
                val qty = (p["qty"] as? Number)?.toDouble() ?: 0.0
                val cost = (p["avgCost"] as? Number)?.toDouble() ?: 0.0
                abs(qty * cost)
            }
        val lines = mutableListOf<String>()
        var used = 0
        for (p in sorted) {
            if (lines.size >= MAX_POSITION_LINES) {
                break
            }
            val piece = formatOnePositionLine(p) ?: continue
            if (used + piece.length + 2 > MAX_HOLDINGS_CHARS && lines.isNotEmpty()) {
                break
            }
            lines.add(piece)
            used += piece.length + 2
        }
        val omitted = positions.size - lines.size
        val base = lines.joinToString("; ")
        return if (omitted > 0) {
            "$base; +$omitted more position row(s) — use atx_function positions_snapshot for full book"
        } else {
            base
        }
    }

    private fun formatOnePositionLine(p: Document): String? {
        val type = p.getString("type")?.trim()?.lowercase().orEmpty().ifEmpty { "stock" }
        val qty = (p["qty"] as? Number)?.toDouble() ?: 0.0
        val absQty = abs(qty)
        val side = if (qty < 0) "short" else "long"
        return when {
            type == "option" && !p.getString("optionType").isNullOrBlank() && p["strike"] is Number -> {
                val expStr = formatOptionExpiryUtc(p.getDate("expiration"))
                val strike = (p["strike"] as Number).toDouble()
                val sk =
                    if (strike.isFinite()) {
                        "%.0f".format(Locale.US, strike)
                    } else {
                        p["strike"].toString()
                    }
                "$side ${formatQty(absQty)}× $expStr $" + sk + " ${p.getString("optionType")}"
            }
            type == "cash" -> "${p.getString("symbol")?.trim().orEmpty().ifEmpty { "CASH" }} cash"
            else -> {
                val sym = p.getString("symbol")?.trim()?.uppercase(Locale.US).orEmpty().ifEmpty { return null }
                val px = (p["avgCost"] as? Number)?.toDouble() ?: 0.0
                "${formatQty(qty)} $sym @ ${formatUsd(px)}"
            }
        }
    }

    private fun formatOptionExpiryUtc(exp: java.util.Date?): String {
        if (exp == null) {
            return "?"
        }
        return Instant.ofEpochMilli(exp.time).atZone(ZoneOffset.UTC).format(EXPIRY_FMT)
    }

    private fun formatQty(q: Double): String =
        if (abs(q % 1.0) < 1e-9) {
            q.toInt().toString()
        } else {
            q.toString()
        }

    private fun formatUsd(amount: Double): String =
        '$' + "%.2f".format(Locale.US, amount)

    companion object {
        private const val MAX_PORTFOLIOS = 12
        private const val MAX_POSITION_LINES = 48
        private const val MAX_HOLDINGS_CHARS = 520
        private const val DEFAULT_CASH = 25_000.0
        private val EXPIRY_FMT = DateTimeFormatter.ofPattern("MMM d", Locale.US).withZone(ZoneOffset.UTC)
    }
}
