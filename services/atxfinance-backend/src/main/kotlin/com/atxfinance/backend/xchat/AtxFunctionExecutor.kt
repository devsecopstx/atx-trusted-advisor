package com.atxfinance.backend.xchat

import com.atxfinance.backend.portfolio.DefaultPortfolioProvisionService
import com.atxfinance.backend.portfolio.PortfolioCrudService
import com.atxfinance.backend.portfolio.PortfolioNestedResourceService
import com.atxfinance.backend.portfolio.PortfolioPriceAlertNlService
import com.atxfinance.backend.portfolio.PositionsService
import com.atxfinance.backend.strategy.StrategyOptionsYahooClient
import com.fasterxml.jackson.databind.ObjectMapper
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.stereotype.Component
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

data class AtxFunctionOptionsScanResult(
    val markdown: String,
    val donePayload: Map<String, Any?>,
)

data class AtxFunctionWatchlistResult(
    val markdown: String,
    val donePayload: Map<String, Any?>,
)

data class AtxFunctionToolResult(
    val result: String,
    val error: String? = null,
)

@Component
class AtxFunctionExecutor(
    private val objectMapper: ObjectMapper,
    private val defaultPortfolioProvisionService: DefaultPortfolioProvisionService,
    private val portfolioCrudService: PortfolioCrudService,
    private val portfolioNestedResourceService: PortfolioNestedResourceService,
    private val positionsService: PositionsService,
    private val optionsActionScanService: OptionsActionScanService,
    private val yahooClient: StrategyOptionsYahooClient,
    private val portfolioPriceAlertNlService: PortfolioPriceAlertNlService,
) {
    fun executeOptionsActionScan(ctx: AtxFunctionExecutionContext): AtxFunctionOptionsScanResult {
        @Suppress("UNCHECKED_CAST")
        val positions =
            (loadPositionsSnapshot(ctx)["positions"] as? List<Any?>)
                ?.mapNotNull { it as? Map<String, Any?> }
                ?: emptyList()
        val watchInner = loadWatchlistPayload(ctx)["watchlist"] as? Map<*, *>
        val built =
            optionsActionScanService.buildScan(
                session = ctx.session,
                portfolioIdHex = ctx.portfolioIdHex,
                positionsRows = positions,
                watchlistInner = watchInner,
            )
        val donePayload =
            directDonePayload(
                markdown = built.asMarkdown,
                model = "options_action_scan_direct",
                optionsActionScan =
                    mapOf(
                        "generatedAt" to built.generatedAt,
                        "planTier" to built.planTier,
                        "truncated" to built.truncated,
                        "rows" to built.rows,
                        "disclaimer" to OPTIONS_ACTION_SCAN_DISCLAIMER,
                    ),
            )
        return AtxFunctionOptionsScanResult(markdown = built.asMarkdown, donePayload = donePayload)
    }

    fun executeWatchlistSnapshot(ctx: AtxFunctionExecutionContext): AtxFunctionWatchlistResult {
        val payload = loadWatchlistPayload(ctx)
        val markdown = buildWatchlistMarkdown(payload)
        val donePayload =
            directDonePayload(
                markdown = markdown,
                model = "watchlist_snapshot_direct",
            )
        return AtxFunctionWatchlistResult(markdown = markdown, donePayload = donePayload)
    }

    fun executeToolCall(
        toolName: String,
        args: Map<String, Any?>,
        ctx: AtxFunctionExecutionContext,
    ): AtxFunctionToolResult {
        val normalized = toolName.trim().lowercase()
        if (normalized == "yahoo_finance") {
            return runCatching { executeYahooFinanceQuote(args) }.getOrElse { ex ->
                AtxFunctionToolResult(result = "", error = ex.message ?: "yahoo_finance_error")
            }
        }
        if (normalized != "atx_function" && normalized != "atxfinance") {
            return AtxFunctionToolResult(result = "", error = "unsupported_tool")
        }
        val operation = (args["operation"] as? String)?.trim()?.lowercase().orEmpty()
        if (operation.isEmpty()) {
            return AtxFunctionToolResult(result = "", error = "missing_operation")
        }
        return runCatching {
            when (operation) {
                "watchlist_snapshot" -> AtxFunctionToolResult(result = toJson(loadWatchlistPayload(ctx)))
                "portfolio_summary" -> AtxFunctionToolResult(result = toJson(loadPortfolioSummary(ctx)))
                "positions_snapshot" -> AtxFunctionToolResult(result = toJson(loadPositionsSnapshot(ctx)))
                "options_action_scan" ->
                    AtxFunctionToolResult(
                        result =
                            toJson(
                                mapOf(
                                    "rows" to
                                        optionsActionScanService.buildScan(
                                            session = ctx.session,
                                            portfolioIdHex = ctx.portfolioIdHex,
                                            positionsRows =
                                                @Suppress("UNCHECKED_CAST")
                                                (loadPositionsSnapshot(ctx)["positions"] as? List<Any?>)
                                                    ?.mapNotNull { it as? Map<String, Any?> }
                                                    ?: emptyList(),
                                            watchlistInner = loadWatchlistPayload(ctx)["watchlist"] as? Map<*, *>,
                                        ).rows,
                                ),
                            ),
                    )
                "price_alert_manage" ->
                    AtxFunctionToolResult(
                        result = toJson(portfolioPriceAlertNlService.executePriceAlertManage(args, ctx)),
                    )
                else -> AtxFunctionToolResult(result = "", error = "unknown_operation")
            }
        }.getOrElse { ex ->
            AtxFunctionToolResult(result = "", error = ex.message ?: "executor_error")
        }
    }

    private fun executeYahooFinanceQuote(args: Map<String, Any?>): AtxFunctionToolResult {
        val raw = (args["symbol"] as? String)?.trim()?.uppercase().orEmpty()
        val sym =
            if (raw.isNotEmpty() && Regex("^[A-Z0-9.^-]{1,15}$").matches(raw)) {
                raw
            } else {
                "TSLA"
            }
        val q = yahooClient.fetchUnderlyingQuote(sym)
            ?: return AtxFunctionToolResult(
                result = toJson(mapOf("error" to "quote_unavailable", "symbol" to sym)),
                error = "quote_unavailable",
            )
        val price = (q["regularMarketPrice"] as? Number)?.toDouble() ?: 0.0
        val payload =
            linkedMapOf<String, Any?>(
                "symbol" to (q["symbol"] ?: sym),
                "price" to price,
                "previousClose" to (q["regularMarketPreviousClose"] as? Number)?.toDouble(),
                "change" to (q["regularMarketChange"] as? Number)?.toDouble(),
                "changePercent" to (q["regularMarketChangePercent"] as? Number)?.toDouble(),
                "currency" to q["currency"],
                "source" to "yahoo-finance2",
            )
        return AtxFunctionToolResult(result = toJson(payload))
    }

    @Suppress("UNCHECKED_CAST")
    private fun preloadPromptJson(ctx: AtxFunctionExecutionContext): Map<String, Any?>? {
        val preloadRoot = ctx.workspacePreload ?: return null
        val preload = (preloadRoot["preload"] as? Map<String, Any?>) ?: preloadRoot
        return (preload["promptJson"] as? Map<String, Any?>) ?: preload
    }

    private fun resolvePortfolioId(ctx: AtxFunctionExecutionContext): String? {
        val explicit = ctx.portfolioIdHex?.trim()?.takeIf { ObjectId.isValid(it) }
        if (explicit != null) {
            portfolioCrudService.findPortfolioForSessionUser(explicit, ctx.session) ?: return null
            return explicit
        }
        return defaultPortfolioProvisionService.getDefaultPortfolioDoc(ctx.session)?.getObjectId("_id")?.toHexString()
    }

    private fun loadWatchlistPayload(ctx: AtxFunctionExecutionContext): Map<String, Any?> {
        preloadPromptJson(ctx)?.get("watchlist")?.let { watchlist ->
            if (watchlist is Map<*, *> && !watchlist.containsKey("error")) {
                return mapOf("watchlist" to watchlist)
            }
        }
        val portfolioId = resolvePortfolioId(ctx)
        if (portfolioId == null) {
            return mapOf("error" to "no_portfolio")
        }
        val payload = portfolioNestedResourceService.getWatchlistPayload(ctx.session, portfolioId, quotes = false)
        if (payload == null) {
            return mapOf("error" to "no_watchlist")
        }
        val data = payload["data"] as? Map<*, *>
        return mapOf("watchlist" to (data ?: payload))
    }

    private fun loadPortfolioSummary(ctx: AtxFunctionExecutionContext): Map<String, Any?> {
        preloadPromptJson(ctx)?.get("portfolio")?.let { portfolio ->
            if (portfolio is Map<*, *>) {
                return mapOf("portfolio" to portfolio)
            }
        }
        val portfolioId = resolvePortfolioId(ctx) ?: return mapOf("error" to "no_portfolio")
        val portfolio = portfolioCrudService.findPortfolioForSessionUser(portfolioId, ctx.session) ?: return mapOf("error" to "no_portfolio")
        val accounts = portfolioCrudService.listAccountsForPortfolio(portfolio.getObjectId("_id")!!, ctx.session)
        val totalPositions =
            accounts.sumOf { account ->
                val accountId = account.getObjectId("_id")?.toHexString() ?: return@sumOf 0
                positionsService.listPositionsForPortfolioAccount(ctx.session, portfolioId, accountId).size
            }
        return mapOf(
            "portfolio" to
                mapOf(
                    "id" to portfolioId,
                    "name" to (portfolio.getString("name") ?: "Portfolio"),
                    "totalPositionCount" to totalPositions,
                    "accountCount" to accounts.size,
                ),
        )
    }

    @Suppress("UNCHECKED_CAST")
    private fun loadPositionsSnapshot(ctx: AtxFunctionExecutionContext): Map<String, Any?> {
        preloadPromptJson(ctx)?.get("positionsPreview")?.let { preview ->
            if (preview is List<*>) {
                return mapOf(
                    "positions" to preview,
                    "truncated" to (preloadPromptJson(ctx)?.get("positionsPreviewTruncated") as? Boolean ?: false),
                )
            }
        }
        val portfolioId = resolvePortfolioId(ctx) ?: return mapOf("error" to "no_portfolio")
        val portfolio = portfolioCrudService.findPortfolioForSessionUser(portfolioId, ctx.session) ?: return mapOf("error" to "no_portfolio")
        val accounts = portfolioCrudService.listAccountsForPortfolio(portfolio.getObjectId("_id")!!, ctx.session)
        val rows = mutableListOf<Map<String, Any?>>()
        for (account in accounts) {
            val accountId = account.getObjectId("_id")?.toHexString() ?: continue
            for (position in positionsService.listPositionsForPortfolioAccount(ctx.session, portfolioId, accountId)) {
                if (rows.size >= MAX_POSITIONS_RETURNED) {
                    return mapOf("positions" to rows, "truncated" to true)
                }
                rows.add(
                    mapOf(
                        "symbol" to (position.getString("symbol") ?: ""),
                        "qty" to ((position["qty"] as? Number)?.toDouble() ?: 0.0),
                        "avgCost" to ((position["avgCost"] as? Number)?.toDouble() ?: 0.0),
                        "accountId" to accountId,
                        "type" to position.getString("type"),
                        "optionType" to position.getString("optionType"),
                        "strike" to (position["strike"] as? Number)?.toDouble(),
                        "expiration" to expirationIsoForSnapshot(position),
                    ),
                )
            }
        }
        return mapOf("positions" to rows, "truncated" to false)
    }

    @Suppress("UNCHECKED_CAST")
    private fun buildWatchlistMarkdown(payload: Map<String, Any?>): String {
        val watchlist = payload["watchlist"] as? Map<*, *>
        if (watchlist == null || watchlist.containsKey("error")) {
            return "## Watchlist\n\n_No watchlist rows for this workspace._"
        }
        val symbols = watchlist["symbols"] as? List<*> ?: emptyList<Any?>()
        return buildString {
            appendLine("## Watchlist")
            appendLine()
            if (symbols.isEmpty()) {
                appendLine("_Empty watchlist._")
            } else {
                for (row in symbols) {
                    val symbol = (row as? Map<*, *>)?.get("symbol")?.toString()?.trim().orEmpty()
                    if (symbol.isNotEmpty()) {
                        appendLine("- $symbol")
                    }
                }
            }
        }.trimEnd()
    }

    private fun directDonePayload(
        markdown: String,
        model: String,
        optionsActionScan: Map<String, Any?>? = null,
    ): Map<String, Any?> {
        val base =
            mutableMapOf<String, Any?>(
                "response" to markdown,
                "model" to model,
                "personaName" to "advisor",
                "contextCount" to 0,
                "contextSource" to "none",
                "collectionSearchStatus" to "skipped_no_collections",
                "toolCalls" to listOf(mapOf("name" to "atx_function", "durationMs" to 0)),
                "interactionMeta" to
                    mapOf(
                        "generationMs" to 0,
                        "sources" to
                            mapOf(
                                "ragChunks" to 0,
                                "toolInvocations" to 1,
                                "personaCollections" to 0,
                                "total" to 1,
                            ),
                    ),
            )
        if (optionsActionScan != null) {
            base["optionsActionScan"] = optionsActionScan
        }
        return base
    }

    private fun toJson(value: Any?): String {
        val raw = objectMapper.writeValueAsString(value ?: emptyMap<String, Any?>())
        if (raw.toByteArray(Charsets.UTF_8).size <= MAX_OUTPUT_BYTES) {
            return raw
        }
        return objectMapper.writeValueAsString(mapOf("error" to "output_too_large"))
    }

    private fun expirationIsoForSnapshot(position: Document): String? {
        val d = position.getDate("expiration")
        if (d != null) {
            return Instant.ofEpochMilli(d.time).atZone(ZoneOffset.UTC).toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE)
        }
        val s = position.getString("expiration")?.trim().orEmpty()
        return s.take(10).takeIf { it.length == 10 && it[4] == '-' && it[7] == '-' }
    }

    companion object {
        private const val MAX_OUTPUT_BYTES = 8 * 1024
        private const val MAX_POSITIONS_RETURNED = 200
        private const val OPTIONS_ACTION_SCAN_DISCLAIMER =
            "Not financial advice. This is for informational purposes only. Past performance does not guarantee future results."
    }
}
