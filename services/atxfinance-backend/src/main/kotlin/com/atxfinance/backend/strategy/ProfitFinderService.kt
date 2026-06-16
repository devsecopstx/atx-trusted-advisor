package com.atxfinance.backend.strategy

import com.atxfinance.backend.audit.AuditEventService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.DefaultPortfolioApiService
import com.atxfinance.backend.portfolio.PortfolioCrudService
import com.atxfinance.backend.session.ResolvedSession
import com.fasterxml.jackson.databind.ObjectMapper
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.beans.factory.ObjectProvider
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlin.math.abs

enum class ProfitFinderMode { CONSERVATIVE, BALANCED, AGGRESSIVE }

enum class ProfitFinderFocus { INCOME, PROTECTION, BOTH }

data class ProfitFinderScanRequest(
    val portfolioId: String? = null,
    val mode: String? = null,
    val focus: String? = null,
    val symbols: List<String>? = null,
    val dteMin: Int? = null,
    val dteMax: Int? = null,
    val maxResults: Int? = null,
    val includeWatchlist: Boolean? = null,
    val allowSyntheticFallback: Boolean? = null,
)

sealed class ProfitFinderOutcome {
    data class Ok(val body: Map<String, Any?>) : ProfitFinderOutcome()
    data class BadRequest(val body: Map<String, Any?>) : ProfitFinderOutcome()
    data class Unavailable(val body: Map<String, Any?>) : ProfitFinderOutcome()
}

@Service
class ProfitFinderService(
    private val engine: OptionsStrategyEngine,
    private val yahooClient: StrategyOptionsYahooClient,
    private val portfolioCrud: PortfolioCrudService,
    private val defaultPortfolioApi: DefaultPortfolioApiService,
    private val portfolioScanner: ProfitFinderPortfolioScanner,
    private val auditEventService: AuditEventService,
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val objectMapper: ObjectMapper,
    private val environment: Environment,
    @Qualifier("cacheRedisTemplate")
    private val redisProvider: ObjectProvider<StringRedisTemplate>,
) {
    fun scan(
        session: ResolvedSession,
        request: ProfitFinderScanRequest?,
    ): ProfitFinderOutcome {
        val parsed = parseRequest(request, session)
            ?: return ProfitFinderOutcome.BadRequest(
                mapOf(
                    "error" to "invalid_profit_finder_context",
                    "message" to "portfolioId and valid mode/focus are required",
                ),
            )

        if (portfolioCrud.findPortfolioForSessionUser(parsed.portfolioId, session) == null) {
            return ProfitFinderOutcome.BadRequest(
                mapOf(
                    "error" to "portfolio_not_found",
                    "message" to "Portfolio not found or not accessible",
                ),
            )
        }

        val cacheKey = cacheKey(session, parsed)
        readCache(cacheKey)?.let { cached ->
            return ProfitFinderOutcome.Ok(cached)
        }

        val scan =
            portfolioScanner.scan(
                session = session,
                portfolioIdHex = parsed.portfolioId,
                includeWatchlist = parsed.includeWatchlist,
                symbolFilter = parsed.symbolFilter,
            )
            ?: return ProfitFinderOutcome.BadRequest(
                mapOf(
                    "error" to "portfolio_not_found",
                    "message" to "Portfolio not found or not accessible",
                ),
            )

        val symbols =
            buildSymbolUniverse(scan, parsed.symbolFilter)
        if (symbols.isEmpty()) {
            val generatedAt = Instant.now().toString()
            val emptyBody = buildResponse(
                parsed = parsed,
                scan = scan,
                symbols = emptyList(),
                opportunities = emptyList(),
                generatedAt = generatedAt,
                cacheHit = false,
                chainsAttempted = 0,
                chainsLoaded = 0,
                statusNote = "No equity holdings or watchlist symbols to scan. Add positions or watchlist tickers first.",
            )
            writeAudit(session, parsed, scan, emptyBody)
            return ProfitFinderOutcome.Ok(emptyBody)
        }

        val chains = linkedMapOf<String, OptionsStrategyEngine.OptionChainSnapshot>()
        var chainsAttempted = 0
        val devSynthetic = parsed.allowSyntheticFallback && OptionsDevChainFallback.isDevOrTestProfile(environment)
        for (symbol in symbols) {
            chainsAttempted += 1
            var chain = loadChainInDteWindow(symbol, parsed.dteMin, parsed.dteMax)
            if (chain == null && devSynthetic) {
                val dteMid = (parsed.dteMin + parsed.dteMax) / 2
                chain = OptionsDevChainFallback.syntheticChain(symbol, dteMid)
            }
            if (chain != null) {
                chains[symbol] = chain
            }
        }

        if (chains.isEmpty()) {
            return ProfitFinderOutcome.Unavailable(
                mapOf(
                    "error" to "chain_unavailable",
                    "message" to "No usable option chains for portfolio symbols in the DTE window",
                    "symbols" to symbols,
                ),
            )
        }

        val context = userContext(parsed.mode, scan.portfolioDeltaHint)
        val preferred = preferredStrategies(parsed.mode, parsed.focus, parsed.optionsApproved)
        val prompt =
            OptionsStrategyEngine.OptionsScanPrompt(
                minScore = parsed.minScore,
                preferredStrategies = preferred,
            )
        val holdingBySymbol = scan.holdings.associateBy { it.symbol }
        val rawRecs =
            engine.generateRecommendations(context, chains, prompt)
                .map { rec ->
                    val boost = portfolioOpportunityBoost(rec, holdingBySymbol[rec.underlying], parsed.focus)
                    rec.copy(score = (rec.score + boost).coerceIn(0, 100))
                }
                .sortedByDescending { it.score }
                .filter { passesFocusGate(it, parsed.focus) }
                .filter { passesConservativePopGate(it, parsed) }
                .filter { passesNakedGate(it, parsed) }

        val opportunities =
            rawRecs.take(parsed.maxResults).map { rec ->
                toOpportunityMap(rec, chains[rec.underlying], holdingBySymbol[rec.underlying], context.outlook)
            }

        val generatedAt = Instant.now().toString()
        val body =
            buildResponse(
                parsed = parsed,
                scan = scan,
                symbols = symbols,
                opportunities = opportunities,
                generatedAt = generatedAt,
                cacheHit = false,
                chainsAttempted = chainsAttempted,
                chainsLoaded = chains.size,
                statusNote =
                    if (opportunities.isEmpty()) {
                        "No structures met conservative filters for ${chains.size} loaded chain(s). Try Balanced mode or widen DTE."
                    } else {
                        null
                    },
            )
        writeCache(cacheKey, body)
        writeAudit(session, parsed, scan, body)
        return ProfitFinderOutcome.Ok(body)
    }

    private fun parseRequest(
        request: ProfitFinderScanRequest?,
        session: ResolvedSession,
    ): ParsedProfitFinderRequest? {
        if (request == null) return null
        val portfolioId =
            request.portfolioId?.trim()?.takeIf { it.isNotEmpty() }
                ?: resolveDefaultPortfolioId(session)
                ?: return null
        if (!PORTFOLIO_ID_REGEX.matches(portfolioId)) return null
        val mode = parseMode(request.mode) ?: ProfitFinderMode.CONSERVATIVE
        val focus = parseFocus(request.focus) ?: ProfitFinderFocus.BOTH
        val dMin = (request.dteMin ?: DEFAULT_DTE_MIN).coerceIn(1, 120)
        val dMax = (request.dteMax ?: DEFAULT_DTE_MAX).coerceIn(dMin, 180)
        val symbolFilter =
            request.symbols
                ?.mapNotNull { normalizeSymbol(it) }
                ?.toSet()
                ?.takeIf { it.isNotEmpty() }
        val maxResults = (request.maxResults ?: DEFAULT_MAX_RESULTS).coerceIn(1, MAX_RESULTS)
        val minScore =
            when (mode) {
                ProfitFinderMode.CONSERVATIVE -> CONSERVATIVE_MIN_SCORE
                ProfitFinderMode.BALANCED -> BALANCED_MIN_SCORE
                ProfitFinderMode.AGGRESSIVE -> AGGRESSIVE_MIN_SCORE
            }
        return ParsedProfitFinderRequest(
            portfolioId = portfolioId,
            mode = mode,
            focus = focus,
            dteMin = dMin,
            dteMax = dMax,
            symbolFilter = symbolFilter,
            maxResults = maxResults,
            minScore = minScore,
            includeWatchlist = request.includeWatchlist != false,
            allowSyntheticFallback = request.allowSyntheticFallback == true,
            optionsApproved = resolveOptionsApproved(session),
        )
    }

    private fun resolveDefaultPortfolioId(session: ResolvedSession): String? {
        val summary = runCatching { defaultPortfolioApi.loadSummaryPayload(session) }.getOrNull() ?: return null
        val data = summary["data"] as? Map<*, *> ?: summary
        val portfolio = data["portfolio"] as? Map<*, *> ?: data
        return (
            portfolio["id"]?.toString()
                ?: portfolio["_id"]?.toString()
        )?.trim()?.takeIf { it.isNotEmpty() }
    }

    private fun buildSymbolUniverse(
        scan: ProfitFinderPortfolioScanner.ScanResult,
        filter: Set<String>?,
    ): List<String> {
        val fromHoldings = scan.holdings.map { it.symbol }
        val fromWatchlist = scan.watchlistSymbols
        return (fromHoldings + fromWatchlist)
            .filter { filter == null || it in filter }
            .distinct()
            .take(MAX_SYMBOLS)
    }

    private fun portfolioOpportunityBoost(
        rec: OptionsStrategyEngine.StrategyRecommendation,
        holding: ProfitFinderPortfolioScanner.HoldingRow?,
        focus: ProfitFinderFocus,
    ): Int {
        if (holding == null) return 0
        val pnlPct = holding.unrealizedPnlPercent ?: return 0
        return when (focus) {
            ProfitFinderFocus.INCOME ->
                when (rec.strategy) {
                    OptionsStrategyEngine.StrategyKind.COVERED_CALL ->
                        if (holding.qty >= 100 && pnlPct > 5) 8 else if (holding.qty >= 100) 4 else 0
                    OptionsStrategyEngine.StrategyKind.CASH_SECURED_PUT,
                    OptionsStrategyEngine.StrategyKind.BULL_PUT_SPREAD,
                    -> if (pnlPct < 0) 5 else 3
                    else -> 0
                }
            ProfitFinderFocus.PROTECTION ->
                when (rec.strategy) {
                    OptionsStrategyEngine.StrategyKind.PROTECTIVE_PUT,
                    OptionsStrategyEngine.StrategyKind.WHEEL_PROTECTIVE_COLLAR,
                    -> if (pnlPct > 15 || holding.costBasis > 25_000) 10 else 5
                    else -> 0
                }
            ProfitFinderFocus.BOTH ->
                portfolioOpportunityBoost(rec, holding, ProfitFinderFocus.INCOME) +
                    portfolioOpportunityBoost(rec, holding, ProfitFinderFocus.PROTECTION) / 2
        }
    }

    private fun passesFocusGate(
        rec: OptionsStrategyEngine.StrategyRecommendation,
        focus: ProfitFinderFocus,
    ): Boolean {
        val income =
            setOf(
                OptionsStrategyEngine.StrategyKind.COVERED_CALL,
                OptionsStrategyEngine.StrategyKind.CASH_SECURED_PUT,
                OptionsStrategyEngine.StrategyKind.BULL_PUT_SPREAD,
                OptionsStrategyEngine.StrategyKind.BEAR_CALL_SPREAD,
                OptionsStrategyEngine.StrategyKind.WHEEL_PROTECTIVE_COLLAR,
            )
        val protection =
            setOf(
                OptionsStrategyEngine.StrategyKind.PROTECTIVE_PUT,
                OptionsStrategyEngine.StrategyKind.WHEEL_PROTECTIVE_COLLAR,
            )
        return when (focus) {
            ProfitFinderFocus.INCOME -> rec.strategy in income
            ProfitFinderFocus.PROTECTION -> rec.strategy in protection
            ProfitFinderFocus.BOTH -> rec.strategy in (income + protection)
        }
    }

    private fun passesConservativePopGate(
        rec: OptionsStrategyEngine.StrategyRecommendation,
        parsed: ParsedProfitFinderRequest,
    ): Boolean {
        if (parsed.mode != ProfitFinderMode.CONSERVATIVE) return true
        val incomeKinds =
            setOf(
                OptionsStrategyEngine.StrategyKind.COVERED_CALL,
                OptionsStrategyEngine.StrategyKind.CASH_SECURED_PUT,
                OptionsStrategyEngine.StrategyKind.BULL_PUT_SPREAD,
                OptionsStrategyEngine.StrategyKind.BEAR_CALL_SPREAD,
            )
        if (rec.strategy !in incomeKinds) return false
        return rec.riskReward.popApproxPercent >= CONSERVATIVE_MIN_POP
    }

    private fun passesNakedGate(
        rec: OptionsStrategyEngine.StrategyRecommendation,
        parsed: ParsedProfitFinderRequest,
    ): Boolean {
        val naked =
            setOf(
                OptionsStrategyEngine.StrategyKind.LONG_CALL,
                OptionsStrategyEngine.StrategyKind.LONG_PUT,
                OptionsStrategyEngine.StrategyKind.LONG_STRADDLE,
            )
        if (rec.strategy !in naked) return true
        return parsed.mode == ProfitFinderMode.AGGRESSIVE && parsed.optionsApproved
    }

    private fun preferredStrategies(
        mode: ProfitFinderMode,
        focus: ProfitFinderFocus,
        optionsApproved: Boolean,
    ): Set<OptionsStrategyEngine.StrategyKind> {
        val income =
            setOf(
                OptionsStrategyEngine.StrategyKind.COVERED_CALL,
                OptionsStrategyEngine.StrategyKind.CASH_SECURED_PUT,
                OptionsStrategyEngine.StrategyKind.BULL_PUT_SPREAD,
            )
        val protection =
            setOf(
                OptionsStrategyEngine.StrategyKind.PROTECTIVE_PUT,
                OptionsStrategyEngine.StrategyKind.WHEEL_PROTECTIVE_COLLAR,
            )
        val base =
            when (focus) {
                ProfitFinderFocus.INCOME -> income
                ProfitFinderFocus.PROTECTION -> protection
                ProfitFinderFocus.BOTH -> income + protection
            }
        return when (mode) {
            ProfitFinderMode.CONSERVATIVE -> base
            ProfitFinderMode.BALANCED -> base + setOf(OptionsStrategyEngine.StrategyKind.BEAR_CALL_SPREAD)
            ProfitFinderMode.AGGRESSIVE ->
                if (optionsApproved) {
                    base + setOf(OptionsStrategyEngine.StrategyKind.IRON_CONDOR)
                } else {
                    base
                }
        }
    }

    private fun userContext(
        mode: ProfitFinderMode,
        portfolioDeltaHint: Double,
    ): OptionsStrategyEngine.UserOptionsContext {
        val risk =
            when (mode) {
                ProfitFinderMode.CONSERVATIVE -> OptionsStrategyEngine.RiskTolerance.CONSERVATIVE
                ProfitFinderMode.BALANCED -> OptionsStrategyEngine.RiskTolerance.MODERATE
                ProfitFinderMode.AGGRESSIVE -> OptionsStrategyEngine.RiskTolerance.AGGRESSIVE
            }
        return OptionsStrategyEngine.UserOptionsContext(
            risk = risk,
            outlook = OptionsStrategyEngine.MarketOutlook.BULLISH,
            portfolioDeltaHint = portfolioDeltaHint,
            marginAccount = mode != ProfitFinderMode.CONSERVATIVE,
        )
    }

    private fun toOpportunityMap(
        rec: OptionsStrategyEngine.StrategyRecommendation,
        chain: OptionsStrategyEngine.OptionChainSnapshot?,
        holding: ProfitFinderPortfolioScanner.HoldingRow?,
        defaultOutlook: OptionsStrategyEngine.MarketOutlook,
    ): Map<String, Any?> {
        val primaryLeg = rec.legs.firstOrNull()
        val contract =
            chain?.let { c ->
                primaryLeg?.let { leg ->
                    if (leg.right == "call") {
                        c.calls.find { abs(it.strike - leg.strike) < 0.02 }
                    } else {
                        c.puts.find { abs(it.strike - leg.strike) < 0.02 }
                    }
                }
            }
        val entryMid = primaryLeg?.let { leg -> chain?.let { legMid(it, leg) } } ?: 0.0
        return mapOf(
            "id" to "${rec.underlying}:${rec.expirationYmd}:${rec.strategy.name.lowercase()}:${primaryLeg?.strike ?: 0}",
            "symbol" to rec.underlying,
            "strategy" to rec.strategy.name.lowercase(),
            "strategyLabel" to rec.strategy.name.lowercase().replace('_', ' '),
            "expirationYmd" to rec.expirationYmd,
            "edgeScore" to rec.score,
            "scoreBreakdown" to rec.scoreBreakdown,
            "rationale" to rec.rationale,
            "outlook" to outlookForStrategy(rec.strategy, defaultOutlook),
            "entry" to entryMid,
            "breakeven" to rec.riskReward.breakeven,
            "popPercent" to rec.riskReward.popApproxPercent,
            "maxProfit" to rec.riskReward.maxProfit,
            "maxLoss" to rec.riskReward.maxLoss,
            "estRoiPercent" to
                if (rec.riskReward.maxLoss > 0) {
                    (rec.riskReward.maxProfit / rec.riskReward.maxLoss * 100.0).coerceIn(0.0, 500.0)
                } else {
                    0.0
                },
            "legs" to
                rec.legs.map {
                    mapOf(
                        "side" to it.side,
                        "right" to it.right,
                        "strike" to it.strike,
                        "expiryYmd" to it.expiryYmd,
                        "quantity" to it.quantity,
                    )
                },
            "greeks" to
                contract?.let {
                    mapOf(
                        "delta" to it.delta,
                        "theta" to estimateTheta(it.impliedVol),
                        "vega" to estimateVega(it.impliedVol),
                    )
                },
            "holdingContext" to
                holding?.let {
                    mapOf(
                        "qty" to it.qty,
                        "avgCost" to it.avgCost,
                        "spotPrice" to it.spotPrice,
                        "unrealizedPnl" to it.unrealizedPnl,
                        "unrealizedPnlPercent" to it.unrealizedPnlPercent,
                        "costBasis" to it.costBasis,
                    )
                },
        )
    }

    private fun buildResponse(
        parsed: ParsedProfitFinderRequest,
        scan: ProfitFinderPortfolioScanner.ScanResult,
        symbols: List<String>,
        opportunities: List<Map<String, Any?>>,
        generatedAt: String,
        cacheHit: Boolean,
        chainsAttempted: Int,
        chainsLoaded: Int,
        statusNote: String?,
    ): Map<String, Any?> {
        val holdingsPayload =
            scan.holdings.map {
                mapOf(
                    "symbol" to it.symbol,
                    "qty" to it.qty,
                    "avgCost" to it.avgCost,
                    "spotPrice" to it.spotPrice,
                    "costBasis" to it.costBasis,
                    "marketValue" to it.marketValue,
                    "unrealizedPnl" to it.unrealizedPnl,
                    "unrealizedPnlPercent" to it.unrealizedPnlPercent,
                    "source" to it.source,
                )
            }
        val meta =
            linkedMapOf<String, Any?>(
                "engine" to "profit_finder",
                "engineVersion" to "mvp-1",
                "mode" to parsed.mode.name.lowercase(),
                "focus" to parsed.focus.name.lowercase(),
                "portfolioId" to scan.portfolioId,
                "portfolioDeltaHint" to scan.portfolioDeltaHint,
                "dteMin" to parsed.dteMin,
                "dteMax" to parsed.dteMax,
                "symbolCount" to symbols.size,
                "symbols" to symbols,
                "watchlistOnlySymbols" to scan.watchlistSymbols,
                "ibkrConsentGranted" to scan.ibkrConsentGranted,
                "ibkrSnapshotIncluded" to false,
                "chainsAttempted" to chainsAttempted,
                "chainsLoaded" to chainsLoaded,
                "generatedAt" to generatedAt,
                "cacheTtlSeconds" to CACHE_TTL_SECONDS,
                "cacheHit" to cacheHit,
                "correlationId" to "profit-finder:${scan.portfolioId}:${generatedAt}",
            )
        if (!statusNote.isNullOrBlank()) {
            meta["statusNote"] = statusNote
        }
        return mapOf(
            "data" to
                mapOf(
                    "holdings" to holdingsPayload,
                    "opportunities" to opportunities,
                    "meta" to meta,
                ),
        )
    }

    private fun writeAudit(
        session: ResolvedSession,
        parsed: ParsedProfitFinderRequest,
        scan: ProfitFinderPortfolioScanner.ScanResult,
        body: Map<String, Any?>,
    ) {
        runCatching {
            @Suppress("UNCHECKED_CAST")
            val data = body["data"] as? Map<String, Any?> ?: return@runCatching
            @Suppress("UNCHECKED_CAST")
            val opportunities = data["opportunities"] as? List<*> ?: emptyList<Any>()
            auditEventService.insertEvent(
                entityType = "profit_finder",
                entityId = scan.portfolioId,
                action = "profit_finder_scan_completed",
                session = session,
                details =
                    mapOf(
                        "mode" to parsed.mode.name.lowercase(),
                        "focus" to parsed.focus.name.lowercase(),
                        "holdingCount" to scan.holdings.size,
                        "opportunityCount" to opportunities.size,
                        "symbolsScanned" to (data["meta"] as? Map<*, *>)?.get("symbols"),
                        "ibkrConsentGranted" to scan.ibkrConsentGranted,
                        "correlationId" to (data["meta"] as? Map<*, *>)?.get("correlationId"),
                    ),
            )
        }
    }

    private fun loadChainInDteWindow(
        symbol: String,
        dteMin: Int,
        dteMax: Int,
    ): OptionsStrategyEngine.OptionChainSnapshot? {
        val expirations =
            yahooClient.fetchOptionsJson(symbol, null)
                ?.let { StrategyOptionsYahooClient.expirationDatesFromYahoo(it) }
                .orEmpty()
        val expiration = chooseExpirationInDteRange(expirations, dteMin, dteMax) ?: return null
        val epoch =
            LocalDate.parse(expiration, DateTimeFormatter.ISO_LOCAL_DATE)
                .atStartOfDay(ZoneOffset.UTC)
                .toEpochSecond()
        val root = yahooClient.fetchOptionsJson(symbol, epoch) ?: return null
        return mapYahooChain(symbol, expiration, root)
    }

    private fun chooseExpirationInDteRange(expirations: List<String>, dteMin: Int, dteMax: Int): String? {
        val today = LocalDate.now(ZoneOffset.UTC)
        val targetMid = (dteMin + dteMax) / 2
        val future =
            expirations.mapNotNull { raw ->
                val d =
                    runCatching { LocalDate.parse(raw, DateTimeFormatter.ISO_LOCAL_DATE) }.getOrNull()
                        ?: return@mapNotNull null
                val dte = ChronoUnit.DAYS.between(today, d).toInt()
                if (dte < 1) return@mapNotNull null
                d to dte
            }
        if (future.isEmpty()) return null
        fun pick(candidates: List<Pair<LocalDate, Int>>): String? =
            candidates
                .minByOrNull { abs(it.second - targetMid) }
                ?.first
                ?.format(DateTimeFormatter.ISO_LOCAL_DATE)
        pick(future.filter { it.second in dteMin..dteMax })?.let { return it }
        pick(future.filter { it.second in dteMin..(dteMax + 21) })?.let { return it }
        return pick(future)
    }

    private fun mapYahooChain(
        symbol: String,
        requestedExpiration: String,
        root: com.fasterxml.jackson.databind.JsonNode,
    ): OptionsStrategyEngine.OptionChainSnapshot? {
        val first = StrategyOptionsYahooClient.firstResult(root) ?: return null
        val quote = first.path("quote").get(0)
        val spot = quote?.path("regularMarketPrice")?.asDouble(0.0)?.takeIf { it > 0 } ?: return null
        val options = first.path("options")
        if (!options.isArray || options.size() == 0) return null
        val group = options.firstOrNull() ?: return null
        val expiration =
            group.path("expiration").asLong(0L).takeIf { it > 0 }
                ?.let {
                    Instant.ofEpochSecond(it).atZone(ZoneOffset.UTC).toLocalDate()
                        .format(DateTimeFormatter.ISO_LOCAL_DATE)
                }
                ?: requestedExpiration
        val calls = mapContracts(group.path("calls"), isCall = true, spot = spot)
        val puts = mapContracts(group.path("puts"), isCall = false, spot = spot)
        if (calls.isEmpty() && puts.isEmpty()) return null
        return OptionsStrategyEngine.OptionChainSnapshot(
            underlying = symbol,
            expirationYmd = expiration,
            spot = spot,
            calls = calls,
            puts = puts,
        )
    }

    private fun mapContracts(
        nodes: com.fasterxml.jackson.databind.JsonNode,
        isCall: Boolean,
        spot: Double,
    ): List<OptionsStrategyEngine.OptionContractSnapshot> {
        if (!nodes.isArray) return emptyList()
        return nodes.mapNotNull { node ->
            val strike = node.path("strike").asDouble(0.0)
            if (strike <= 0) return@mapNotNull null
            val bid = node.path("bid").asDouble(0.0)
            val ask = node.path("ask").asDouble(0.0)
            val last = node.path("lastPrice").asDouble(0.0)
            val premium =
                when {
                    bid > 0 && ask > 0 -> (bid + ask) / 2.0
                    last > 0 -> last
                    else -> 0.0
                }
            val quoteBid = if (bid > 0) bid else premium
            val quoteAsk = if (ask > 0) ask else premium
            if (quoteBid <= 0 && quoteAsk <= 0) return@mapNotNull null
            val effectiveBid = if (quoteBid > 0) quoteBid else quoteAsk
            val effectiveAsk = if (quoteAsk > 0) quoteAsk else quoteBid
            OptionsStrategyEngine.OptionContractSnapshot(
                strike = strike,
                impliedVol = node.path("impliedVolatility").asDouble(0.0).coerceIn(0.0, 5.0),
                openInterest = node.path("openInterest").asLong(0L).coerceAtLeast(0L),
                volume = node.path("volume").asLong(0L).coerceAtLeast(0L),
                bid = effectiveBid,
                ask = effectiveAsk,
                delta = estimateDelta(spot, strike, isCall),
                isCall = isCall,
            )
        }.sortedBy { it.strike }
    }

    private fun estimateDelta(spot: Double, strike: Double, isCall: Boolean): Double {
        if (spot <= 0 || strike <= 0) return if (isCall) 0.5 else -0.5
        val moneyness = ((spot - strike) / spot).coerceIn(-0.5, 0.5)
        return if (isCall) (0.5 + moneyness).coerceIn(0.05, 0.95) else (-0.5 + moneyness).coerceIn(-0.95, -0.05)
    }

    private fun legMid(chain: OptionsStrategyEngine.OptionChainSnapshot, leg: OptionsStrategyEngine.OptionLeg): Double {
        val c =
            if (leg.right == "call") {
                chain.calls.find { abs(it.strike - leg.strike) < 0.02 }
            } else {
                chain.puts.find { abs(it.strike - leg.strike) < 0.02 }
            }
        return c?.let { (it.bid + it.ask) / 2.0 } ?: 0.0
    }

    private fun outlookForStrategy(
        kind: OptionsStrategyEngine.StrategyKind,
        default: OptionsStrategyEngine.MarketOutlook,
    ): String =
        when (kind) {
            OptionsStrategyEngine.StrategyKind.CASH_SECURED_PUT,
            OptionsStrategyEngine.StrategyKind.BULL_PUT_SPREAD,
            OptionsStrategyEngine.StrategyKind.LONG_CALL,
            -> "bullish"
            OptionsStrategyEngine.StrategyKind.BEAR_CALL_SPREAD,
            OptionsStrategyEngine.StrategyKind.PROTECTIVE_PUT,
            OptionsStrategyEngine.StrategyKind.LONG_PUT,
            -> "bearish"
            OptionsStrategyEngine.StrategyKind.IRON_CONDOR,
            OptionsStrategyEngine.StrategyKind.LONG_STRADDLE,
            -> "neutral"
            else -> default.name.lowercase()
        }

    private fun estimateTheta(iv: Double): Double = (-0.05 * iv.coerceIn(0.1, 1.5))

    private fun estimateVega(iv: Double): Double = (0.12 * iv.coerceIn(0.1, 1.5))

    private fun cacheKey(session: ResolvedSession, parsed: ParsedProfitFinderRequest): String =
        "xf:profit-finder:v1:${session.tenantId}:${session.userId}:${parsed.portfolioId}:${parsed.mode}:${parsed.focus}:${parsed.dteMin}:${parsed.dteMax}"

    private fun readCache(key: String): Map<String, Any?>? {
        val redis = redisProvider.ifAvailable ?: return null
        val raw = redis.opsForValue().get(key) ?: return null
        return runCatching {
            @Suppress("UNCHECKED_CAST")
            objectMapper.readValue(raw, Map::class.java) as Map<String, Any?>
        }.getOrNull()?.let { cached ->
            val data = cached["data"] as? MutableMap<String, Any?> ?: return@let null
            val meta = (data["meta"] as? MutableMap<String, Any?>) ?: mutableMapOf()
            meta["cacheHit"] = true
            data["meta"] = meta
            cached
        }
    }

    private fun writeCache(key: String, body: Map<String, Any?>) {
        val redis = redisProvider.ifAvailable ?: return
        runCatching {
            redis.opsForValue().set(key, objectMapper.writeValueAsString(body), java.time.Duration.ofSeconds(CACHE_TTL_SECONDS))
        }
    }

    private fun parseMode(raw: String?): ProfitFinderMode? {
        return when (raw?.trim()?.lowercase()) {
            "conservative", null, "" -> ProfitFinderMode.CONSERVATIVE
            "balanced", "moderate" -> ProfitFinderMode.BALANCED
            "aggressive" -> ProfitFinderMode.AGGRESSIVE
            else -> null
        }
    }

    private fun parseFocus(raw: String?): ProfitFinderFocus? {
        return when (raw?.trim()?.lowercase()) {
            null, "", "both", "balanced" -> ProfitFinderFocus.BOTH
            "income" -> ProfitFinderFocus.INCOME
            "protection", "hedge" -> ProfitFinderFocus.PROTECTION
            else -> null
        }
    }

    private fun normalizeSymbol(raw: String): String? {
        val s = raw.trim().uppercase()
        return if (SYMBOL_REGEX.matches(s)) s else null
    }

    private fun resolveOptionsApproved(session: ResolvedSession): Boolean {
        val uid = runCatching { ObjectId(session.userId) }.getOrNull() ?: return false
        val user = mongoTemplate.findById(uid, Document::class.java, props.coreUsersCollection) ?: return false
        return user.getBoolean("optionsTradingEnabled", false)
    }

    private companion object {
        val PORTFOLIO_ID_REGEX = Regex("^[a-fA-F0-9]{24}$")
        val SYMBOL_REGEX = Regex("^[A-Z0-9.\\-]{1,12}$")
        const val DEFAULT_DTE_MIN = 14
        const val DEFAULT_DTE_MAX = 45
        const val CONSERVATIVE_MIN_SCORE = 65
        const val BALANCED_MIN_SCORE = 60
        const val AGGRESSIVE_MIN_SCORE = 55
        const val CONSERVATIVE_MIN_POP = 58.0
        const val DEFAULT_MAX_RESULTS = 12
        const val MAX_RESULTS = 24
        const val MAX_SYMBOLS = 16
        const val CACHE_TTL_SECONDS = 1800L
    }

    private data class ParsedProfitFinderRequest(
        val portfolioId: String,
        val mode: ProfitFinderMode,
        val focus: ProfitFinderFocus,
        val dteMin: Int,
        val dteMax: Int,
        val symbolFilter: Set<String>?,
        val maxResults: Int,
        val minScore: Int,
        val includeWatchlist: Boolean,
        val allowSyntheticFallback: Boolean,
        val optionsApproved: Boolean,
    )
}