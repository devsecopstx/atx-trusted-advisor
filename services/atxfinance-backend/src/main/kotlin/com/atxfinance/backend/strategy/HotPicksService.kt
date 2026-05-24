package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PortfolioCrudService
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.session.ResolvedSession
import com.fasterxml.jackson.databind.ObjectMapper
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlin.math.abs

enum class HotPicksScope { PORTFOLIO, WATCHLIST, MARKET }

enum class HotPicksBias { CONSERVATIVE, BALANCED, AGGRESSIVE }

data class HotPicksQuery(
    val scope: HotPicksScope,
    val bias: HotPicksBias,
    val portfolioId: String?,
    val minEdgeScore: Int,
    val maxEdgeScore: Int,
    val dteMin: Int,
    val dteMax: Int,
    val minPopPercent: Double,
    val optionsApproved: Boolean,
)

sealed class HotPicksOutcome {
    data class Ok(val body: Map<String, Any?>) : HotPicksOutcome()
    data class BadRequest(val body: Map<String, Any?>) : HotPicksOutcome()
    data class Unavailable(val body: Map<String, Any?>) : HotPicksOutcome()
}

@Service
class HotPicksService(
    private val engine: OptionsStrategyEngine,
    private val yahooClient: StrategyOptionsYahooClient,
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val portfolioCrud: PortfolioCrudService,
    private val objectMapper: ObjectMapper,
    @Qualifier("cacheRedisTemplate")
    private val redisProvider: ObjectProvider<StringRedisTemplate>,
) {
    private val symbolRegex = Regex("^[A-Z0-9.\\-]{1,12}$")
    private val portfolioIdRegex = Regex("^[a-fA-F0-9]{24}$")
    private val defaultMarketSymbols =
        listOf("SPY", "QQQ", "AAPL", "MSFT", "NVDA", "TSLA", "AMD", "META", "AMZN", "GOOGL", "RKLB", "RDW")

    fun load(
        session: ResolvedSession,
        rawScope: String?,
        rawBias: String?,
        portfolioId: String?,
        minEdge: Int?,
        maxEdge: Int?,
        dteMin: Int?,
        dteMax: Int?,
    ): HotPicksOutcome {
        val scope = parseScope(rawScope) ?: return bad("invalid_scope", "scope must be portfolio, watchlist, or market")
        val bias = parseBias(rawBias) ?: return bad("invalid_bias", "bias must be conservative, balanced, or aggressive")
        val dMin = (dteMin ?: 7).coerceIn(1, 90)
        val dMax = (dteMax ?: 21).coerceIn(dMin, 120)
        val minScore = (minEdge ?: 60).coerceIn(0, 100)
        val maxScore = (maxEdge ?: 90).coerceIn(minScore, 100)
        val pid = portfolioId?.trim()?.takeIf { it.isNotEmpty() }
        if (scope == HotPicksScope.PORTFOLIO && (pid == null || !portfolioIdRegex.matches(pid))) {
            return bad("invalid_portfolio", "portfolioId is required for portfolio scope")
        }
        if (scope == HotPicksScope.PORTFOLIO && pid != null) {
            if (portfolioCrud.findPortfolioForSessionUser(pid, session) == null) {
                return bad("portfolio_not_found", "Portfolio not found or not accessible")
            }
        }

        val optionsApproved = resolveOptionsApproved(session)
        val query =
            HotPicksQuery(
                scope = scope,
                bias = bias,
                portfolioId = pid,
                minEdgeScore = minScore,
                maxEdgeScore = maxScore,
                dteMin = dMin,
                dteMax = dMax,
                minPopPercent = if (bias == HotPicksBias.CONSERVATIVE) 60.0 else 55.0,
                optionsApproved = optionsApproved,
            )

        val cacheKey = hotPicksCacheKey(session, query)
        readCache(cacheKey)?.let { cached ->
            return HotPicksOutcome.Ok(cached)
        }

        val symbols = resolveSymbols(session, query).take(MAX_SYMBOLS)
        if (symbols.isEmpty()) {
            return HotPicksOutcome.Ok(
                emptyPayload(
                    query,
                    symbols = emptyList(),
                    picks = emptyList(),
                    cachedAt = Instant.now().toString(),
                    cacheHit = false,
                ),
            )
        }

        val chains = LinkedHashMap<String, OptionsStrategyEngine.OptionChainSnapshot>()
        val skewBySymbol = LinkedHashMap<String, List<Map<String, Any?>>>()
        var chainsAttempted = 0
        val dteMid = (query.dteMin + query.dteMax) / 2
        val devSynthetic = OptionsDevChainFallback.isDevOrTestProfile()
        for (symbol in symbols) {
            chainsAttempted += 1
            var chain = loadChainInDteWindow(symbol, query.dteMin, query.dteMax)
            if (chain == null && devSynthetic) {
                chain = OptionsDevChainFallback.syntheticChain(symbol, dteMid)
            }
            if (chain == null) {
                continue
            }
            chains[symbol] = chain
            skewBySymbol[symbol] = buildIvSkewPanel(chain)
        }
        if (chains.isEmpty()) {
            val generatedAt = Instant.now().toString()
            return HotPicksOutcome.Ok(
                emptyPayload(
                    query,
                    symbols = symbols,
                    picks = emptyList(),
                    cachedAt = generatedAt,
                    cacheHit = false,
                    chainsAttempted = chainsAttempted,
                    chainsLoaded = 0,
                    statusNote =
                        "No liquid option chains in the ${query.dteMin}–${query.dteMax} DTE window for this universe. " +
                            "Try All market scope, lower the edge floor, or refresh after the next weekly expiry posts.",
                ),
            )
        }

        val context = userContextForBias(query.bias)
        val preferred = preferredStrategiesForBias(query.bias, query.optionsApproved)
        val prompt =
            OptionsStrategyEngine.OptionsScanPrompt(
                minScore = query.minEdgeScore,
                preferredStrategies = preferred,
            )
        val rawRecs =
            engine.generateRecommendations(context, chains, prompt)
                .filter { it.score <= query.maxEdgeScore }
                .filter { passesConservativePopGate(it, query) }
                .filter { passesNakedGate(it, query) }

        val picks =
            rawRecs.take(MAX_PICKS).map { rec ->
                val primaryLeg = rec.legs.firstOrNull()
                val contract =
                    chains[rec.underlying]?.let { chain ->
                        primaryLeg?.let { leg ->
                            if (leg.right == "call") {
                                chain.calls.find { abs(it.strike - leg.strike) < 0.02 }
                            } else {
                                chain.puts.find { abs(it.strike - leg.strike) < 0.02 }
                            }
                        }
                    }
                val entryMid =
                    primaryLeg?.let { leg ->
                        val chain = chains[rec.underlying] ?: return@let null
                        legMid(chain, leg)
                    } ?: 0.0
                val maxGainPct =
                    if (rec.riskReward.maxLoss > 0) {
                        (rec.riskReward.maxProfit / rec.riskReward.maxLoss * 100.0).coerceIn(-999.0, 999.0)
                    } else {
                        0.0
                    }
                val maxLossPct =
                    if (rec.riskReward.maxProfit > 0) {
                        (-rec.riskReward.maxLoss / rec.riskReward.maxProfit * 100.0).coerceIn(-999.0, 0.0)
                    } else {
                        -100.0
                    }
                val estRoiPct =
                    if (rec.riskReward.maxLoss > 0) {
                        (rec.riskReward.maxProfit / rec.riskReward.maxLoss * 100.0).coerceIn(0.0, 500.0)
                    } else {
                        0.0
                    }
                val ivRank =
                    contract?.let {
                        OptionsStrategyEngine.normalizeIv(it.impliedVol) * 100.0
                    } ?: 0.0
                mapOf(
                    "id" to "${rec.underlying}:${rec.expirationYmd}:${rec.strategy.name.lowercase()}:${primaryLeg?.strike ?: 0}",
                    "symbol" to rec.underlying,
                    "expirationYmd" to rec.expirationYmd,
                    "strategy" to rec.strategy.name.lowercase(),
                    "strategyLabel" to strategyLabel(rec.strategy),
                    "contractLabel" to contractLabel(rec, primaryLeg),
                    "outlook" to outlookForStrategy(rec.strategy, context.outlook),
                    "edgeScore" to rec.score,
                    "entry" to entryMid,
                    "breakeven" to rec.riskReward.breakeven,
                    "popPercent" to rec.riskReward.popApproxPercent,
                    "estRoiPercent" to estRoiPct,
                    "ivRankPercent" to ivRank,
                    "maxGainPercent" to maxGainPct,
                    "maxLossPercent" to maxLossPct,
                    "rationale" to rec.rationale,
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
                                "gamma" to estimateGamma(it.delta),
                                "theta" to estimateTheta(it.impliedVol),
                                "vega" to estimateVega(it.impliedVol),
                            )
                        },
                    "ivSkew" to
                        skewBySymbol[rec.underlying]?.let { skew ->
                            mapOf(
                                "points" to skew,
                                "putSkewLabel" to putSkewLabel(skew),
                                "intensity" to skewIntensity(skew),
                                "insight" to skewInsight(skew, rec.underlying),
                            )
                        },
                )
            }

        val generatedAt = Instant.now().toString()
        val body =
            emptyPayload(
                query,
                symbols = symbols,
                picks = picks,
                cachedAt = generatedAt,
                cacheHit = false,
                chainsAttempted = chainsAttempted,
                chainsLoaded = chains.size,
                statusNote = if (picks.isEmpty()) {
                    "No structures met edge score ${query.minEdgeScore}–${query.maxEdgeScore} and bias filters for ${chains.size} loaded chain(s)."
                } else {
                    null
                },
            )
        writeCache(cacheKey, body)
        return HotPicksOutcome.Ok(body)
    }

    private fun emptyPayload(
        query: HotPicksQuery,
        symbols: List<String>,
        picks: List<Map<String, Any?>>,
        cachedAt: String,
        cacheHit: Boolean,
        chainsAttempted: Int = 0,
        chainsLoaded: Int = 0,
        statusNote: String? = null,
    ): Map<String, Any?> =
        mapOf(
            "data" to
                mapOf(
                    "picks" to picks,
                    "meta" to
                        buildMetaMap(
                            query = query,
                            symbols = symbols,
                            cachedAt = cachedAt,
                            cacheHit = cacheHit,
                            chainsAttempted = chainsAttempted,
                            chainsLoaded = chainsLoaded,
                            statusNote = statusNote,
                        ),
                ),
        )

    private fun buildMetaMap(
        query: HotPicksQuery,
        symbols: List<String>,
        cachedAt: String,
        cacheHit: Boolean,
        chainsAttempted: Int,
        chainsLoaded: Int,
        statusNote: String?,
    ): Map<String, Any?> {
        val meta =
            linkedMapOf<String, Any?>(
                "scope" to query.scope.name.lowercase(),
                "bias" to query.bias.name.lowercase(),
                "portfolioId" to query.portfolioId,
                "minEdgeScore" to query.minEdgeScore,
                "maxEdgeScore" to query.maxEdgeScore,
                "dteMin" to query.dteMin,
                "dteMax" to query.dteMax,
                "symbolCount" to symbols.size,
                "symbols" to symbols,
                "chainsAttempted" to chainsAttempted,
                "chainsLoaded" to chainsLoaded,
                "cachedAt" to cachedAt,
                "cacheTtlSeconds" to CACHE_TTL_SECONDS,
                "cacheHit" to cacheHit,
            )
        if (!statusNote.isNullOrBlank()) {
            meta["statusNote"] = statusNote
        }
        return meta
    }

    private fun resolveSymbols(session: ResolvedSession, query: HotPicksQuery): List<String> {
        return when (query.scope) {
            HotPicksScope.MARKET -> defaultMarketSymbols
            HotPicksScope.WATCHLIST -> loadWatchlistSymbols(session)
            HotPicksScope.PORTFOLIO -> {
                val pid = query.portfolioId ?: return emptyList()
                loadPortfolioUnderlyingSymbols(session, ObjectId(pid))
            }
        }.mapNotNull { normalizeSymbol(it) }.distinct()
    }

    private fun loadWatchlistSymbols(session: ResolvedSession): List<String> {
        val q = Query.query(PortfolioMongoFilter.watchlistSessionReadCriteria(session))
        val doc = mongoTemplate.findOne(q, Document::class.java, props.watchlistsCollection) ?: return emptyList()
        val symbols = doc.getList("symbols", Document::class.java) ?: return emptyList()
        return symbols.mapNotNull { it.getString("symbol")?.trim()?.uppercase() }
    }

    private fun loadPortfolioUnderlyingSymbols(session: ResolvedSession, portfolioId: ObjectId): List<String> {
        val accountFilter =
            Criteria.where("portfolioId").`is`(portfolioId)
                .and("tenantId").`is`(ObjectId(session.tenantId))
                .and("userId").`is`(ObjectId(session.userId))
        val accounts =
            mongoTemplate.find(
                Query.query(accountFilter),
                Document::class.java,
                props.accountsCollection,
            )
        val accountIds = accounts.mapNotNull { it.getObjectId("_id") }
        if (accountIds.isEmpty()) {
            return emptyList()
        }
        val posFilter =
            Criteria.where("accountId").`in`(accountIds)
                .and("tenantId").`is`(ObjectId(session.tenantId))
        val positions =
            mongoTemplate.find(
                Query.query(posFilter),
                Document::class.java,
                props.positionsCollection,
            )
        val out = mutableListOf<String>()
        for (p in positions) {
            val sym = p.getString("symbol")?.trim()?.uppercase() ?: continue
            if (symbolRegex.matches(sym)) {
                out.add(sym)
            }
        }
        return out
    }

    private fun resolveOptionsApproved(session: ResolvedSession): Boolean {
        val uid = runCatching { ObjectId(session.userId) }.getOrNull() ?: return false
        val user =
            mongoTemplate.findById(uid, Document::class.java, props.coreUsersCollection) ?: return false
        return user.getBoolean("optionsTradingEnabled", false)
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
        pick(future.filter { it.second in dteMin..(dteMax + 14) })?.let { return it }
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

    private fun userContextForBias(bias: HotPicksBias): OptionsStrategyEngine.UserOptionsContext {
        val risk =
            when (bias) {
                HotPicksBias.CONSERVATIVE -> OptionsStrategyEngine.RiskTolerance.CONSERVATIVE
                HotPicksBias.BALANCED -> OptionsStrategyEngine.RiskTolerance.MODERATE
                HotPicksBias.AGGRESSIVE -> OptionsStrategyEngine.RiskTolerance.AGGRESSIVE
            }
        val outlook =
            when (bias) {
                HotPicksBias.AGGRESSIVE -> OptionsStrategyEngine.MarketOutlook.NEUTRAL
                else -> OptionsStrategyEngine.MarketOutlook.BULLISH
            }
        return OptionsStrategyEngine.UserOptionsContext(
            risk = risk,
            outlook = outlook,
            portfolioDeltaHint = 0.0,
            marginAccount = bias != HotPicksBias.CONSERVATIVE,
        )
    }

    private fun preferredStrategiesForBias(
        bias: HotPicksBias,
        optionsApproved: Boolean,
    ): Set<OptionsStrategyEngine.StrategyKind> {
        val income =
            setOf(
                OptionsStrategyEngine.StrategyKind.COVERED_CALL,
                OptionsStrategyEngine.StrategyKind.CASH_SECURED_PUT,
                OptionsStrategyEngine.StrategyKind.BULL_PUT_SPREAD,
                OptionsStrategyEngine.StrategyKind.BEAR_CALL_SPREAD,
            )
        return when (bias) {
            HotPicksBias.CONSERVATIVE -> income
            HotPicksBias.BALANCED ->
                income + setOf(OptionsStrategyEngine.StrategyKind.WHEEL_PROTECTIVE_COLLAR)
            HotPicksBias.AGGRESSIVE ->
                if (optionsApproved) {
                    income + setOf(OptionsStrategyEngine.StrategyKind.IRON_CONDOR)
                } else {
                    income
                }
        }
    }

    private fun passesConservativePopGate(
        rec: OptionsStrategyEngine.StrategyRecommendation,
        query: HotPicksQuery,
    ): Boolean {
        if (query.bias != HotPicksBias.CONSERVATIVE) return true
        val incomeKinds =
            setOf(
                OptionsStrategyEngine.StrategyKind.COVERED_CALL,
                OptionsStrategyEngine.StrategyKind.CASH_SECURED_PUT,
                OptionsStrategyEngine.StrategyKind.BULL_PUT_SPREAD,
                OptionsStrategyEngine.StrategyKind.BEAR_CALL_SPREAD,
            )
        if (rec.strategy !in incomeKinds) return false
        return rec.riskReward.popApproxPercent >= query.minPopPercent
    }

    private fun passesNakedGate(
        rec: OptionsStrategyEngine.StrategyRecommendation,
        query: HotPicksQuery,
    ): Boolean {
        val naked =
            setOf(
                OptionsStrategyEngine.StrategyKind.LONG_CALL,
                OptionsStrategyEngine.StrategyKind.LONG_PUT,
                OptionsStrategyEngine.StrategyKind.LONG_STRADDLE,
            )
        if (rec.strategy !in naked) return true
        return query.bias == HotPicksBias.AGGRESSIVE && query.optionsApproved
    }

    private fun buildIvSkewPanel(chain: OptionsStrategyEngine.OptionChainSnapshot): List<Map<String, Any?>> {
        val puts = chain.puts.sortedBy { it.strike }.take(8)
        return puts.map {
            mapOf(
                "strike" to it.strike,
                "ivPercent" to (it.impliedVol.coerceIn(0.0, 3.0) * 100.0),
                "side" to "put",
            )
        }
    }

    private fun putSkewLabel(skew: List<Map<String, Any?>>): String {
        if (skew.size < 2) return "Neutral skew"
        val first = (skew.first()["ivPercent"] as? Number)?.toDouble() ?: 0.0
        val last = (skew.last()["ivPercent"] as? Number)?.toDouble() ?: 0.0
        return if (last > first + 3) "Put skew (bearish)" else "Skew balanced"
    }

    private fun skewIntensity(skew: List<Map<String, Any?>>): String {
        if (skew.size < 2) return "low"
        val vals = skew.mapNotNull { (it["ivPercent"] as? Number)?.toDouble() }
        val spread = (vals.maxOrNull() ?: 0.0) - (vals.minOrNull() ?: 0.0)
        return when {
            spread >= 12 -> "high"
            spread >= 6 -> "medium"
            else -> "low"
        }
    }

    private fun skewInsight(skew: List<Map<String, Any?>>, symbol: String): String {
        val label = putSkewLabel(skew)
        return "$symbol: $label — desk uses skew for strike selection, not direction calls."
    }

    private fun strategyLabel(kind: OptionsStrategyEngine.StrategyKind): String =
        kind.name.lowercase().replace('_', ' ')

    private fun contractLabel(
        rec: OptionsStrategyEngine.StrategyRecommendation,
        leg: OptionsStrategyEngine.OptionLeg?,
    ): String {
        if (leg == null) return rec.underlying
        val side = leg.right.uppercase()
        val exp = rec.expirationYmd.substring(5).replace("-", "/")
        return "${rec.underlying} $exp ${leg.strike.toInt()}$side"
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

    private fun estimateGamma(delta: Double): Double = (0.04 * (1.0 - abs(delta))).coerceIn(0.01, 0.08)

    private fun estimateTheta(iv: Double): Double = (-0.05 * iv.coerceIn(0.1, 1.5))

    private fun estimateVega(iv: Double): Double = (0.12 * iv.coerceIn(0.1, 1.5))

    private fun hotPicksCacheKey(session: ResolvedSession, query: HotPicksQuery): String =
        "xf:hot-picks:v1:${session.tenantId}:${session.userId}:${query.scope}:${query.bias}:${query.portfolioId ?: "_"}:${query.minEdgeScore}:${query.maxEdgeScore}:${query.dteMin}:${query.dteMax}"

    private fun readCache(key: String): Map<String, Any?>? {
        val redis = redisProvider.ifAvailable ?: return null
        val raw = redis.opsForValue().get(key) ?: return null
        return runCatching {
            @Suppress("UNCHECKED_CAST")
            objectMapper.readValue(raw, Map::class.java) as Map<String, Any?>
        }.getOrNull()?.let { cached ->
            val data = cached["data"] as? MutableMap<String, Any?> ?: return@let null
            val meta = (data["meta"] as? MutableMap<String, Any?>) ?: mutableMapOf<String, Any?>()
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

    private fun parseScope(raw: String?): HotPicksScope? {
        val n = raw?.trim()?.lowercase()?.replace('-', '_') ?: "portfolio"
        return when (n) {
            "portfolio", "book" -> HotPicksScope.PORTFOLIO
            "watchlist" -> HotPicksScope.WATCHLIST
            "market", "all_market", "all" -> HotPicksScope.MARKET
            else -> null
        }
    }

    private fun parseBias(raw: String?): HotPicksBias? {
        val n = raw?.trim()?.lowercase() ?: "balanced"
        return when (n) {
            "conservative" -> HotPicksBias.CONSERVATIVE
            "balanced", "moderate" -> HotPicksBias.BALANCED
            "aggressive" -> HotPicksBias.AGGRESSIVE
            else -> null
        }
    }

    private fun normalizeSymbol(raw: String): String? {
        val s = raw.trim().uppercase()
        return if (symbolRegex.matches(s)) s else null
    }

    private fun bad(code: String, message: String): HotPicksOutcome.BadRequest =
        HotPicksOutcome.BadRequest(mapOf("error" to code, "message" to message))

    private companion object {
        const val CACHE_TTL_SECONDS = 3600L
        const val MAX_SYMBOLS = 16
        const val MAX_PICKS = 24
    }
}
