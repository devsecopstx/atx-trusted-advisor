package com.atxfinance.backend.xchat

import com.atxfinance.backend.portfolio.DefaultPortfolioProvisionService
import com.atxfinance.backend.portfolio.PortfolioCrudService
import com.atxfinance.backend.portfolio.PortfolioNestedResourceService
import com.atxfinance.backend.portfolio.PortfolioPriceAlertNlService
import com.atxfinance.backend.portfolio.PositionsService
import com.atxfinance.backend.portfolio.UserWorkspaceSummaryNlService
import com.atxfinance.backend.strategy.StrategyOptionsYahooClient
import com.fasterxml.jackson.databind.ObjectMapper
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.stereotype.Component
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.round

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
    private val userWorkspaceSummaryNlService: UserWorkspaceSummaryNlService,
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
        val markdown = buildWatchlistMarkdown(payload, ctx.portfolioIdHex?.trim()?.lowercase())
        val donePayload =
            directDonePayload(
                markdown = markdown,
                model = "watchlist_snapshot_direct",
            )
        return AtxFunctionWatchlistResult(markdown = markdown, donePayload = donePayload)
    }

    fun executeMarketQuoteDirect(symbol: String): AtxFunctionWatchlistResult {
        val sym = symbol.trim().uppercase().ifBlank { "TSLA" }
        val markdown =
            runCatching {
                val q =
                    yahooClient.fetchEquityQuote(sym)
                        ?: return@runCatching "### $sym Quote\n\n_Quote unavailable from Yahoo Finance right now._"
                formatMarketQuoteMarkdown(sym, q)
            }.getOrElse {
                "### $sym Quote\n\n_Quote unavailable from Yahoo Finance right now._"
            }
        val donePayload =
            directDonePayload(
                markdown = markdown,
                model = "market_quote_direct",
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
                "watchlist_snapshot" ->
                    AtxFunctionToolResult(result = toJson(loadWatchlistSnapshotForTool(ctx), "watchlist_snapshot"))
                "watchlist_add_symbols" -> executeWatchlistAddSymbols(args, ctx)
                "watchlist_remove_symbols" -> executeWatchlistRemoveSymbols(args, ctx)
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
                "user_workspace_summary" ->
                    AtxFunctionToolResult(result = toJson(userWorkspaceSummaryNlService.buildUserWorkspaceSummary(ctx)))
                "price_alert_manage" ->
                    AtxFunctionToolResult(
                        result = toJson(portfolioPriceAlertNlService.executePriceAlertManage(args, ctx)),
                    )
                "market_quote" -> executeYahooFinanceQuote(args)
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
        val q =
            yahooClient.fetchEquityQuote(sym)
                ?: return AtxFunctionToolResult(
                    result = toJson(mapOf("error" to "quote_unavailable", "symbol" to sym)),
                    error = "quote_unavailable",
                )
        val price =
            listOf(
                    q["regularMarketPrice"] as? Number,
                    q["postMarketPrice"] as? Number,
                    q["preMarketPrice"] as? Number,
                )
                .mapNotNull { it?.toDouble() }
                .firstOrNull { it > 0.0 }
                ?: 0.0
        if (price <= 0.0) {
            return AtxFunctionToolResult(
                result = toJson(mapOf("error" to "quote_unavailable", "symbol" to sym)),
                error = "quote_unavailable",
            )
        }
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

    private fun executeWatchlistAddSymbols(
        args: Map<String, Any?>,
        ctx: AtxFunctionExecutionContext,
    ): AtxFunctionToolResult {
        val toAdd = parseTickerListFromArgs(args)
        if (toAdd.isEmpty()) {
            return AtxFunctionToolResult(
                result =
                    toJson(
                        mapOf(
                            "error" to "no_symbols",
                            "hint" to "Provide symbols (array) or symbol (string), e.g. NVDA.",
                        ),
                    ),
            )
        }
        val portfolioId = resolvePortfolioId(ctx) ?: return AtxFunctionToolResult(result = toJson(mapOf("error" to "no_default_portfolio")))
        val existingPayload = portfolioNestedResourceService.getWatchlistPayload(ctx.session, portfolioId, quotes = false)
        val existingSyms =
            ((existingPayload?.get("data") as? Map<*, *>)?.get("symbols") as? List<*>)
                ?.mapNotNull { (it as? Map<*, *>)?.get("symbol")?.toString()?.trim()?.uppercase() }
                ?.toSet()
                ?: emptySet()
        val addEntries =
            toAdd.map { sym ->
                if (existingSyms.contains(sym)) {
                    mapOf("symbol" to sym)
                } else {
                    mapOf(
                        "symbol" to sym,
                        "lineType" to WATCHLIST_ENTRY_DEFAULT_LINE_TYPE,
                        "strategy" to WATCHLIST_ENTRY_DEFAULT_STRATEGY,
                    )
                }
            }
        val patched =
            portfolioNestedResourceService.patchWatchlist(
                session = ctx.session,
                portfolioId = portfolioId,
                quotes = false,
                addSymbols = null,
                addEntries = addEntries,
                removeSymbols = null,
                dedupe = null,
                name = null,
            )
                ?: return AtxFunctionToolResult(result = toJson(mapOf("error" to "no_watchlist")))
        return AtxFunctionToolResult(
            result =
                toJson(
                    mapOf(
                        "ok" to true,
                        "requested" to toAdd,
                        "addedNew" to toAdd.filter { !existingSyms.contains(it) },
                        "alreadyPresent" to toAdd.filter { existingSyms.contains(it) },
                        "watchlistName" to ((patched["data"] as? Map<*, *>)?.get("name") ?: "watchlist"),
                        "symbolCount" to (((patched["data"] as? Map<*, *>)?.get("symbols") as? List<*>)?.size ?: 0),
                    ),
                ),
        )
    }

    private fun executeWatchlistRemoveSymbols(
        args: Map<String, Any?>,
        ctx: AtxFunctionExecutionContext,
    ): AtxFunctionToolResult {
        val toRemove = parseTickerListFromArgs(args)
        if (toRemove.isEmpty()) {
            return AtxFunctionToolResult(
                result =
                    toJson(
                        mapOf(
                            "error" to "no_symbols",
                            "hint" to "Provide symbols (array) or symbol (string) to remove.",
                        ),
                    ),
            )
        }
        val portfolioId = resolvePortfolioId(ctx) ?: return AtxFunctionToolResult(result = toJson(mapOf("error" to "no_default_portfolio")))
        val patched =
            portfolioNestedResourceService.patchWatchlist(
                session = ctx.session,
                portfolioId = portfolioId,
                quotes = false,
                addSymbols = null,
                addEntries = null,
                removeSymbols = toRemove,
                dedupe = null,
                name = null,
            )
                ?: return AtxFunctionToolResult(result = toJson(mapOf("error" to "no_watchlist")))
        return AtxFunctionToolResult(
            result =
                toJson(
                    mapOf(
                        "ok" to true,
                        "removed" to toRemove,
                        "watchlistName" to ((patched["data"] as? Map<*, *>)?.get("name") ?: "watchlist"),
                        "symbolCount" to (((patched["data"] as? Map<*, *>)?.get("symbols") as? List<*>)?.size ?: 0),
                    ),
                ),
        )
    }

    private fun parseTickerListFromArgs(args: Map<String, Any?>, max: Int = 20): List<String> {
        val out = LinkedHashSet<String>()
        val symRegex = Regex("^[A-Z0-9.\\-]{1,32}$")
        (args["symbols"] as? List<*>)?.forEach { item ->
            if (item !is String) {
                return@forEach
            }
            val t = item.trim().uppercase(Locale.ROOT)
            if (t.isNotEmpty() && symRegex.matches(t)) {
                out.add(t)
            }
        }
        (args["symbol"] as? String)?.trim()?.uppercase(Locale.ROOT)?.takeIf { it.isNotEmpty() && symRegex.matches(it) }?.let {
            out.add(it)
        }
        (args["ticker"] as? String)?.trim()?.uppercase(Locale.ROOT)?.takeIf { it.isNotEmpty() && symRegex.matches(it) }?.let {
            out.add(it)
        }
        return out.take(max)
    }

    @Suppress("UNCHECKED_CAST")
    private fun loadWatchlistSnapshotForTool(ctx: AtxFunctionExecutionContext): Map<String, Any?> {
        val payload = loadWatchlistPayload(ctx)
        val watchlist = payload["watchlist"] as? Map<String, Any?>
        if (watchlist == null) {
            return if (payload.containsKey("error")) payload else mapOf("error" to "no_watchlist")
        }
        if (watchlist.containsKey("error")) {
            return mapOf("error" to watchlist["error"])
        }
        val symbolsRaw = watchlist["symbols"] as? List<*> ?: emptyList<Any?>()
        val upperSyms = ArrayList<String>()
        for (raw in symbolsRaw) {
            val row = raw as? Map<*, *> ?: continue
            val sym = row["symbol"]?.toString()?.trim()?.uppercase(Locale.ROOT).orEmpty()
            if (sym.isNotEmpty()) {
                upperSyms.add(sym)
            }
        }
        val liveBySymbol =
            runCatching { yahooClient.fetchEquityQuoteBatch(upperSyms) }.getOrElse { emptyMap() }
        val symbols = ArrayList<Map<String, Any?>>()
        for (raw in symbolsRaw) {
            val row = raw as? Map<*, *> ?: continue
            val sym = row["symbol"]?.toString()?.trim()?.uppercase(Locale.ROOT).orEmpty()
            if (sym.isEmpty()) {
                continue
            }
            val quote = liveBySymbol[sym]
            val live = (quote?.get("regularMarketPrice") as? Number)?.toDouble()?.takeIf { it.isFinite() && it > 0 }
            val entry = (row["entryPrice"] as? Number)?.toDouble()
            symbols.add(
                linkedMapOf(
                    "symbol" to sym,
                    "addedAt" to row["addedAt"],
                    "spotPriceDisplay" to formatUsd2(live),
                    "targetEntryNotional100xUsdDisplay" to formatTargetEntryNotional100xUsd(live),
                    "targetEntryNotional100xDisplay" to formatTargetEntryNotional100xDigits(live),
                    "lineType" to row["lineType"],
                    "strategy" to row["strategy"],
                    "quantity" to row["quantity"],
                    "entryPrice" to entry,
                    "targetEntryPrice" to entry,
                    "targetEntryDisplay" to entry?.let { formatUsd2(it) },
                ).filterValues { it != null },
            )
        }
        return mapOf(
            "name" to (watchlist["name"] ?: "watchlist"),
            "symbolCount" to symbols.size,
            "symbols" to symbols,
        )
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
    /**
     * Matches Next.js `postProcessWatchlistMarkdown` / `renderEnhancedTableMarkdown` shape so BFF + Spring SSE
     * users see the same GFM table as in-process `watchlist_snapshot_direct` (Spot, 100× target, desk, 1D Δ, xOptions).
     */
    private fun buildWatchlistMarkdown(
        payload: Map<String, Any?>,
        portfolioIdHex: String?,
    ): String {
        val watchlist = payload["watchlist"] as? Map<*, *>
        if (watchlist == null || watchlist.containsKey("error")) {
            return "### Watchlist\n\n_No watchlist rows for this workspace._"
        }
        val title = (watchlist["name"] as? String)?.trim()?.takeIf { it.isNotEmpty() } ?: "watchlist"
        val symbols = watchlist["symbols"] as? List<*> ?: emptyList<Any?>()
        if (symbols.isEmpty()) {
            return "### Watchlist — $title\n\n_Empty watchlist._"
        }

        val pidSuffix =
            portfolioIdHex
                ?.trim()
                ?.takeIf { ObjectId.isValid(it) }
                ?.let { "&portfolioId=${it.lowercase(Locale.ROOT)}" }
                .orEmpty()

        val symbolRows = ArrayList<Pair<String, Map<*, *>>>()
        for (raw in symbols) {
            val row = raw as? Map<*, *> ?: continue
            val symbol = row["symbol"]?.toString()?.trim()?.uppercase(Locale.ROOT).orEmpty()
            if (symbol.isEmpty()) {
                continue
            }
            symbolRows.add(symbol to row)
        }
        if (symbolRows.isEmpty()) {
            return "### Watchlist — $title\n\n_Empty watchlist._"
        }

        val batchQuotes =
            runCatching { yahooClient.fetchEquityQuoteBatch(symbolRows.map { it.first }) }.getOrElse { emptyMap() }

        val tableLines = ArrayList<String>()
        tableLines.add("| Symbol | Type | Strategy | Qty | Spot | Target entry (100×) | Desk entry | 1D Δ | To target | xOptions |")
        tableLines.add("| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |")

        var rowCount = 0
        for ((symbol, row) in symbolRows) {
            rowCount++

            val lineType = escapeWatchlistTableCell(row["lineType"]?.toString()?.trim().orEmpty().ifBlank { "—" })
            val strategy = escapeWatchlistTableCell(row["strategy"]?.toString()?.trim().orEmpty().ifBlank { "—" })
            val qtyCell = formatWatchlistQtyCell((row["quantity"] as? Number)?.toDouble())
            val deskEntry = (row["entryPrice"] as? Number)?.toDouble()?.takeIf { it.isFinite() && it > 0 }

            val quote =
                batchQuotes[symbol]
                    ?: runCatching { yahooClient.fetchUnderlyingQuote(symbol) }.getOrNull()
            val live = (quote?.get("regularMarketPrice") as? Number)?.toDouble()?.takeIf { it.isFinite() && it > 0 }
            val spot = formatUsd2(live)
            val target100x = formatTargetEntryNotional100xUsd(live)
            val desk = deskEntry?.let { formatUsd2(it) } ?: "—"
            val change = (quote?.get("regularMarketChange") as? Number)?.toDouble()
            val changePct = (quote?.get("regularMarketChangePercent") as? Number)?.toDouble()
            val delta = formatSignedUsdWithPct(change, changePct)
            val toTarget = formatDistanceToTargetPct(live, deskEntry)

            val href = "/xoptions?symbol=$symbol&action=build$pidSuffix"
            val cta = "[Open $symbol]($href \"Open xOptions for $symbol\")"

            tableLines.add(
                "| $symbol | $lineType | $strategy | $qtyCell | $spot | $target100x | $desk | $delta | $toTarget | $cta |",
            )
        }

        if (rowCount == 0) {
            return "### Watchlist — $title\n\n_Empty watchlist._"
        }

        val symWord = if (rowCount == 1) "symbol" else "symbols"
        val intro =
            "### Watchlist — $title\n\n$rowCount $symWord (Spot and **Target entry** use live marks where available; desk **Entry** is your saved price)."
        return buildString {
            appendLine(intro)
            appendLine()
            for (ln in tableLines) {
                appendLine(ln)
            }
            appendLine()
            appendLine("_Not investment advice. Quotes are indicative._")
        }.trimEnd()
    }

    private fun escapeWatchlistTableCell(value: String): String = value.replace("|", "·").replace("\n", " ").trim()

    private fun formatWatchlistQtyCell(qty: Double?): String {
        if (qty == null || !qty.isFinite()) {
            return "—"
        }
        return if (qty == qty.toLong().toDouble()) {
            qty.toLong().toString()
        } else {
            String.format(Locale.US, "%.4f", qty)
        }
    }

    private fun formatUsd2(value: Double?): String {
        if (value == null || !value.isFinite() || value <= 0) {
            return "—"
        }
        return NumberFormat.getCurrencyInstance(Locale.US).format(value)
    }

    /** Whole-dollar notional = round(100 × spot), USD — matches Next `formatWatchlistTargetEntryNotional100xUsd`. */
    private fun formatTargetEntryNotional100xUsd(spot: Double?): String {
        if (spot == null || !spot.isFinite() || spot <= 0) {
            return "—"
        }
        val whole = round(100.0 * spot).toLong()
        val nf =
            NumberFormat.getCurrencyInstance(Locale.US).apply {
                maximumFractionDigits = 0
                minimumFractionDigits = 0
            }
        return nf.format(whole)
    }

    private fun formatSignedUsdWithPct(
        change: Double?,
        changePct: Double?,
    ): String {
        val usdPart =
            if (change != null && change.isFinite()) {
                val cur = NumberFormat.getCurrencyInstance(Locale.US).format(abs(change))
                (if (change >= 0) "+" else "-") + cur
            } else {
                null
            }
        val pctPart =
            if (changePct != null && changePct.isFinite()) {
                val sign = if (changePct >= 0) "+" else "-"
                "$sign${String.format(Locale.US, "%.2f", abs(changePct))}%"
            } else {
                null
            }
        return when {
            usdPart != null && pctPart != null -> "$usdPart ($pctPart)"
            usdPart != null -> usdPart
            pctPart != null -> pctPart
            else -> "—"
        }
    }

    private fun formatDistanceToTargetPct(
        live: Double?,
        deskEntry: Double?,
    ): String {
        if (live == null || deskEntry == null || live <= 0 || deskEntry <= 0) {
            return "—"
        }
        val pct = ((deskEntry - live) / live) * 100.0
        val sign = if (pct >= 0) "+" else "-"
        return "$sign${String.format(Locale.US, "%.2f", abs(pct))}%"
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

    private fun formatMarketQuoteMarkdown(
        sym: String,
        q: Map<String, Any?>,
    ): String {
        val price =
            listOf(
                    q["regularMarketPrice"] as? Number,
                    q["postMarketPrice"] as? Number,
                    q["preMarketPrice"] as? Number,
                )
                .mapNotNull { it?.toDouble() }
                .firstOrNull { it > 0.0 }
        val prev = (q["regularMarketPreviousClose"] as? Number)?.toDouble()
        val change = (q["regularMarketChange"] as? Number)?.toDouble()
        val changePct = (q["regularMarketChangePercent"] as? Number)?.toDouble()
        val lines = ArrayList<String>()
        lines.add("## $sym Quote")
        lines.add("")
        lines.add("**Last:** ${formatUsd2(price)}")
        if (change != null && change.isFinite() && changePct != null && changePct.isFinite()) {
            val chSign = if (change >= 0) "+" else ""
            val pctSign = if (changePct >= 0) "+" else ""
            lines.add("**Change:** $chSign${String.format(Locale.US, "%.2f", change)} ($pctSign${String.format(Locale.US, "%.2f", changePct)}%)")
        }
        lines.add("**Previous close:** ${formatUsd2(prev)}")
        lines.add("")
        lines.add("_Market data from Yahoo Finance — delayed._")
        lines.add("")
        lines.add("[[xchat-cite:market_quote|Yahoo Finance|$sym]]")
        return lines.joinToString("\n")
    }

    /** Whole-dollar digits for tool JSON (no currency symbol). */
    private fun formatTargetEntryNotional100xDigits(spot: Double?): String {
        if (spot == null || !spot.isFinite() || spot <= 0) {
            return "—"
        }
        return NumberFormat.getIntegerInstance(Locale.US).format(round(100.0 * spot).toLong())
    }

    private fun toJson(
        value: Any?,
        operation: String? = null,
    ): String {
        val raw = objectMapper.writeValueAsString(value ?: emptyMap<String, Any?>())
        if (operation in NO_TRUNCATE_JSON_OPERATIONS) {
            return raw
        }
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
        private const val WATCHLIST_ENTRY_DEFAULT_LINE_TYPE = "Stock"
        private const val WATCHLIST_ENTRY_DEFAULT_STRATEGY = "balanced"
        private val NO_TRUNCATE_JSON_OPERATIONS = setOf("watchlist_snapshot", "options_action_scan")
        private const val OPTIONS_ACTION_SCAN_DISCLAIMER =
            "Not financial advice. This is for informational purposes only. Past performance does not guarantee future results."
    }
}
