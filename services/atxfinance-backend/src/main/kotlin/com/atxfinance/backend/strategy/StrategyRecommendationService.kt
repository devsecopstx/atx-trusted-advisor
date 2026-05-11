package com.atxfinance.backend.strategy

import com.atxfinance.backend.session.ResolvedSession
import com.fasterxml.jackson.databind.JsonNode
import org.springframework.core.env.Environment
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

data class GenerateStrategyRecommendationsRequest(
    val portfolioId: String? = null,
    val symbols: List<String>? = null,
    val outlook: String? = null,
    val risk: String? = null,
    val horizonDays: Int? = null,
    val preferredStrategies: List<String>? = null,
    val maxResults: Int? = null,
    val allowSyntheticFallback: Boolean? = null,
)

sealed class StrategyRecommendationGenerateOutcome {
    data class Ok(val body: Map<String, Any?>) : StrategyRecommendationGenerateOutcome()
    data class BadRequest(val body: Map<String, Any?>) : StrategyRecommendationGenerateOutcome()
    data class Unavailable(val body: Map<String, Any?>) : StrategyRecommendationGenerateOutcome()
}

@Service
class StrategyRecommendationService(
    private val engine: OptionsStrategyEngine,
    private val yahooClient: StrategyOptionsYahooClient,
    private val environment: Environment,
) {
    fun generate(
        session: ResolvedSession,
        request: GenerateStrategyRecommendationsRequest?,
    ): StrategyRecommendationGenerateOutcome {
        val parsed = parseRequest(request)
            ?: return StrategyRecommendationGenerateOutcome.BadRequest(
                mapOf(
                    "error" to "invalid_strategy_context",
                    "message" to "symbols, outlook, risk, and horizonDays are required",
                ),
            )

        val chains = LinkedHashMap<String, OptionsStrategyEngine.OptionChainSnapshot>()
        val chainSources = LinkedHashMap<String, String>()
        for (symbol in parsed.symbols) {
            val chain = loadChain(symbol, parsed.horizonDays)
            if (chain != null) {
                chains[symbol] = chain
                chainSources[symbol] = "yahoo"
                continue
            }
            if (parsed.allowSyntheticFallback && isDevOrTestProfile()) {
                chains[symbol] = syntheticChain(symbol, parsed.horizonDays)
                chainSources[symbol] = "synthetic"
            }
        }

        if (chains.isEmpty()) {
            return StrategyRecommendationGenerateOutcome.Unavailable(
                mapOf(
                    "error" to "engine_unavailable",
                    "message" to "No usable option chains were available for the requested symbols",
                    "symbols" to parsed.symbols,
                ),
            )
        }

        val context = OptionsStrategyEngine.UserOptionsContext(
            risk = parsed.risk,
            outlook = parsed.outlook,
            portfolioDeltaHint = 0.0,
            marginAccount = parsed.risk != OptionsStrategyEngine.RiskTolerance.CONSERVATIVE,
        )
        val prompt = OptionsStrategyEngine.OptionsScanPrompt(
            minScore = OptionsStrategyEngine.DEFAULT_MIN_SCORE,
            preferredStrategies = parsed.preferredStrategies,
        )
        val recommendations = engine.generateRecommendations(context, chains, prompt)
            .take(parsed.maxResults)
            .map { it.toTransportMap() }

        return StrategyRecommendationGenerateOutcome.Ok(
            mapOf(
                "data" to mapOf(
                    "recommendations" to recommendations,
                    "source" to if (chainSources.values.distinct().size == 1) chainSources.values.first() else "mixed",
                    "chainSources" to chainSources,
                    "generatedAt" to Instant.now().toString(),
                    "correlationId" to "strategy-recs:${session.tenantId}:${session.userId}:${Instant.now().toEpochMilli()}",
                    "portfolioId" to parsed.portfolioId,
                    "input" to mapOf(
                        "symbols" to parsed.symbols,
                        "outlook" to parsed.outlook.name.lowercase(),
                        "risk" to parsed.risk.name.lowercase(),
                        "horizonDays" to parsed.horizonDays,
                        "preferredStrategies" to parsed.preferredStrategies?.map { it.name.lowercase() },
                        "maxResults" to parsed.maxResults,
                    ),
                ),
            ),
        )
    }

    private fun parseRequest(request: GenerateStrategyRecommendationsRequest?): ParsedStrategyRecommendationRequest? {
        if (request == null) {
            return null
        }
        val symbols = request.symbols
            ?.mapNotNull { normalizeSymbol(it) }
            ?.distinct()
            ?.take(MAX_SYMBOLS)
            .orEmpty()
        if (symbols.isEmpty()) {
            return null
        }
        val outlook = parseEnum<OptionsStrategyEngine.MarketOutlook>(request.outlook) ?: return null
        val risk = parseEnum<OptionsStrategyEngine.RiskTolerance>(request.risk) ?: return null
        val horizonDays = request.horizonDays?.takeIf { it in 1..365 } ?: return null
        val portfolioId = request.portfolioId?.trim()?.takeIf { it.isNotEmpty() }
        if (portfolioId != null && !Regex("^[a-fA-F0-9]{24}$").matches(portfolioId)) {
            return null
        }
        val preferred = request.preferredStrategies
            ?.mapNotNull { parseEnum<OptionsStrategyEngine.StrategyKind>(it) }
            ?.toSet()
            ?.takeIf { it.isNotEmpty() }
        val maxResults = (request.maxResults ?: DEFAULT_MAX_RESULTS).coerceIn(1, MAX_RESULTS)
        return ParsedStrategyRecommendationRequest(
            portfolioId = portfolioId,
            symbols = symbols,
            outlook = outlook,
            risk = risk,
            horizonDays = horizonDays,
            preferredStrategies = preferred,
            maxResults = maxResults,
            allowSyntheticFallback = request.allowSyntheticFallback == true,
        )
    }

    private fun loadChain(symbol: String, horizonDays: Int): OptionsStrategyEngine.OptionChainSnapshot? {
        val expirations = yahooClient.fetchOptionsJson(symbol, null)
            ?.let { StrategyOptionsYahooClient.expirationDatesFromYahoo(it) }
            .orEmpty()
        val expiration = chooseExpiration(expirations, horizonDays) ?: return null
        val epoch = LocalDate.parse(expiration, DateTimeFormatter.ISO_LOCAL_DATE)
            .atStartOfDay(ZoneOffset.UTC)
            .toEpochSecond()
        val root = yahooClient.fetchOptionsJson(symbol, epoch) ?: return null
        return mapYahooChain(symbol, expiration, root)
    }

    private fun chooseExpiration(expirations: List<String>, horizonDays: Int): String? {
        val today = LocalDate.now(ZoneOffset.UTC)
        val target = today.plusDays(horizonDays.toLong())
        return expirations
            .mapNotNull { raw ->
                runCatching { LocalDate.parse(raw, DateTimeFormatter.ISO_LOCAL_DATE) }.getOrNull()
            }
            .filter { !it.isBefore(today) }
            .minByOrNull { abs(ChronoUnit.DAYS.between(target, it)) }
            ?.format(DateTimeFormatter.ISO_LOCAL_DATE)
    }

    private fun mapYahooChain(
        symbol: String,
        requestedExpiration: String,
        root: JsonNode,
    ): OptionsStrategyEngine.OptionChainSnapshot? {
        val first = StrategyOptionsYahooClient.firstResult(root) ?: return null
        val quote = first.path("quote").get(0)
        val spot = quote?.path("regularMarketPrice")?.asDouble(0.0)?.takeIf { it > 0 } ?: return null
        val options = first.path("options")
        if (!options.isArray || options.size() == 0) {
            return null
        }
        val group = options.firstOrNull() ?: return null
        val expiration = group.path("expiration").asLong(0L).takeIf { it > 0 }
            ?.let { Instant.ofEpochSecond(it).atZone(ZoneOffset.UTC).toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE) }
            ?: requestedExpiration
        val calls = mapContracts(group.path("calls"), isCall = true, spot = spot)
        val puts = mapContracts(group.path("puts"), isCall = false, spot = spot)
        if (calls.isEmpty() && puts.isEmpty()) {
            return null
        }
        return OptionsStrategyEngine.OptionChainSnapshot(
            underlying = symbol,
            expirationYmd = expiration,
            spot = spot,
            calls = calls,
            puts = puts,
        )
    }

    private fun mapContracts(
        nodes: JsonNode,
        isCall: Boolean,
        spot: Double,
    ): List<OptionsStrategyEngine.OptionContractSnapshot> {
        if (!nodes.isArray) {
            return emptyList()
        }
        return nodes.mapNotNull { node ->
            val strike = node.path("strike").asDouble(0.0)
            if (strike <= 0) {
                return@mapNotNull null
            }
            val bid = node.path("bid").asDouble(0.0)
            val ask = node.path("ask").asDouble(0.0)
            val last = node.path("lastPrice").asDouble(0.0)
            val premium = when {
                bid > 0 && ask > 0 -> (bid + ask) / 2.0
                last > 0 -> last
                else -> 0.0
            }
            val quoteBid = if (bid > 0) bid else premium
            val quoteAsk = if (ask > 0) ask else premium
            if (quoteBid <= 0 || quoteAsk <= 0) {
                return@mapNotNull null
            }
            OptionsStrategyEngine.OptionContractSnapshot(
                strike = strike,
                impliedVol = node.path("impliedVolatility").asDouble(0.0).coerceIn(0.0, 5.0),
                openInterest = node.path("openInterest").asLong(0L).coerceAtLeast(0L),
                volume = node.path("volume").asLong(0L).coerceAtLeast(0L),
                bid = quoteBid,
                ask = quoteAsk,
                delta = estimateDelta(spot, strike, isCall),
                isCall = isCall,
            )
        }.sortedBy { it.strike }
    }

    private fun estimateDelta(spot: Double, strike: Double, isCall: Boolean): Double {
        if (spot <= 0 || strike <= 0) {
            return if (isCall) 0.5 else -0.5
        }
        val moneyness = ((spot - strike) / spot).coerceIn(-0.5, 0.5)
        return if (isCall) {
            (0.5 + moneyness).coerceIn(0.05, 0.95)
        } else {
            (-0.5 + moneyness).coerceIn(-0.95, -0.05)
        }
    }

    private fun syntheticChain(symbol: String, horizonDays: Int): OptionsStrategyEngine.OptionChainSnapshot {
        val spot = 100.0
        val expiration = LocalDate.now(ZoneOffset.UTC)
            .plusDays(horizonDays.toLong())
            .format(DateTimeFormatter.ISO_LOCAL_DATE)
        val strikes = listOf(90.0, 95.0, 100.0, 105.0, 110.0)
        fun contract(strike: Double, isCall: Boolean) = OptionsStrategyEngine.OptionContractSnapshot(
            strike = strike,
            impliedVol = 0.42,
            openInterest = 1200L,
            volume = 400L,
            bid = 1.9,
            ask = 2.1,
            delta = estimateDelta(spot, strike, isCall),
            isCall = isCall,
        )
        return OptionsStrategyEngine.OptionChainSnapshot(
            underlying = symbol,
            expirationYmd = expiration,
            spot = spot,
            calls = strikes.map { contract(it, true) },
            puts = strikes.map { contract(it, false) },
        )
    }

    private fun isDevOrTestProfile(): Boolean {
        val profiles = environment.activeProfiles.map { it.lowercase() }.toSet()
        return profiles.contains("dev") || profiles.contains("development") || profiles.contains("test")
    }

    private fun OptionsStrategyEngine.StrategyRecommendation.toTransportMap(): Map<String, Any?> =
        mapOf(
            "strategy" to strategy.name.lowercase(),
            "underlying" to underlying,
            "expirationYmd" to expirationYmd,
            "score" to score,
            "scoreBreakdown" to scoreBreakdown,
            "legs" to legs.map {
                mapOf(
                    "side" to it.side,
                    "right" to it.right,
                    "strike" to it.strike,
                    "expiryYmd" to it.expiryYmd,
                    "quantity" to it.quantity,
                )
            },
            "riskReward" to mapOf(
                "maxProfit" to riskReward.maxProfit,
                "maxLoss" to riskReward.maxLoss,
                "breakeven" to riskReward.breakeven,
                "popApproxPercent" to riskReward.popApproxPercent,
            ),
            "rationale" to rationale,
            "tailRiskSummary" to tailRiskSummary,
        )

    private data class ParsedStrategyRecommendationRequest(
        val portfolioId: String?,
        val symbols: List<String>,
        val outlook: OptionsStrategyEngine.MarketOutlook,
        val risk: OptionsStrategyEngine.RiskTolerance,
        val horizonDays: Int,
        val preferredStrategies: Set<OptionsStrategyEngine.StrategyKind>?,
        val maxResults: Int,
        val allowSyntheticFallback: Boolean,
    )

    private companion object {
        const val DEFAULT_MAX_RESULTS = 5
        const val MAX_RESULTS = 10
        const val MAX_SYMBOLS = 5

        fun normalizeSymbol(raw: String): String? {
            val symbol = raw.trim().uppercase()
            if (!Regex("^[A-Z0-9.\\-]{1,12}$").matches(symbol)) {
                return null
            }
            return symbol
        }

        inline fun <reified T : Enum<T>> parseEnum(raw: String?): T? {
            val normalized = raw?.trim()?.uppercase()?.replace("-", "_") ?: return null
            return enumValues<T>().firstOrNull { it.name == normalized }
        }
    }
}
