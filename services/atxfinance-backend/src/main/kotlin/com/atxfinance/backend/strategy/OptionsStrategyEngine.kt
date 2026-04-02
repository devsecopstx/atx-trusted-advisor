package com.atxfinance.backend.strategy

import org.springframework.stereotype.Component
import kotlin.math.abs
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/** Rule-based options recommendation pipeline for scheduled daily_options_scanner / options_scanner (see repo strategy-engine.md). */
@Component
class OptionsStrategyEngine {

    data class UserOptionsContext(
        val risk: RiskTolerance,
        val outlook: MarketOutlook,
        /** Portfolio delta hint in [-1, 1] — positive = net long delta. */
        val portfolioDeltaHint: Double = 0.0,
        val marginAccount: Boolean = true,
    )

    enum class RiskTolerance { CONSERVATIVE, MODERATE, AGGRESSIVE }

    enum class MarketOutlook { BULLISH, BEARISH, NEUTRAL }

    enum class StrategyKind {
        COVERED_CALL,
        CASH_SECURED_PUT,
        PROTECTIVE_PUT,
        LONG_STRADDLE,
        IRON_CONDOR,
        BULL_PUT_SPREAD,
        BEAR_CALL_SPREAD,
        LONG_CALL,
        LONG_PUT,
    }

    data class OptionsScanPrompt(
        val minScore: Int = DEFAULT_MIN_SCORE,
        val weights: Map<String, Double> = emptyMap(),
        val preferredStrategies: Set<StrategyKind>? = null,
    )

    data class OptionContractSnapshot(
        val strike: Double,
        val impliedVol: Double,
        val openInterest: Long,
        val volume: Long,
        val bid: Double,
        val ask: Double,
        val delta: Double,
        val isCall: Boolean,
    )

    data class OptionChainSnapshot(
        val underlying: String,
        val expirationYmd: String,
        val spot: Double,
        val calls: List<OptionContractSnapshot>,
        val puts: List<OptionContractSnapshot>,
    )

    data class OptionLeg(
        val side: String,
        val right: String,
        val strike: Double,
        val expiryYmd: String,
        val quantity: Int,
    )

    data class RiskRewardMetrics(
        val maxProfit: Double,
        val maxLoss: Double,
        val breakeven: Double,
        val popApproxPercent: Double,
    )

    data class StrategyRecommendation(
        val strategy: StrategyKind,
        val underlying: String,
        val expirationYmd: String,
        val score: Int,
        val scoreBreakdown: Map<String, Double>,
        val legs: List<OptionLeg>,
        val riskReward: RiskRewardMetrics,
        val rationale: String,
    )

    fun filterEligibleStrategies(context: UserOptionsContext): List<StrategyKind> {
        val base = when (context.outlook) {
            MarketOutlook.BULLISH -> listOf(
                StrategyKind.COVERED_CALL,
                StrategyKind.CASH_SECURED_PUT,
                StrategyKind.BULL_PUT_SPREAD,
                StrategyKind.LONG_CALL,
            )
            MarketOutlook.BEARISH -> listOf(
                StrategyKind.PROTECTIVE_PUT,
                StrategyKind.BEAR_CALL_SPREAD,
                StrategyKind.LONG_PUT,
            )
            MarketOutlook.NEUTRAL -> listOf(
                StrategyKind.IRON_CONDOR,
                StrategyKind.LONG_STRADDLE,
            )
        }
        val gated = when (context.risk) {
            RiskTolerance.CONSERVATIVE -> base.filter {
                context.outlook == MarketOutlook.NEUTRAL ||
                    (it != StrategyKind.LONG_STRADDLE && it != StrategyKind.IRON_CONDOR)
            }
            RiskTolerance.MODERATE -> base
            RiskTolerance.AGGRESSIVE -> (base + StrategyKind.LONG_STRADDLE).distinct()
        }
        return gated.distinct()
    }

    fun calculateFitScore(
        strategy: StrategyKind,
        chain: OptionChainSnapshot,
        contract: OptionContractSnapshot,
        context: UserOptionsContext,
        prompt: OptionsScanPrompt,
    ): Pair<Int, Map<String, Double>> {
        val sIv = normalizeIv(contract.impliedVol)
        val sOi = normalizeOi(contract.openInterest)
        val sVol = normalizeVol(contract.volume)
        val sLiq = liquidityScore(contract.bid, contract.ask, chain.spot)
        val sPort = portfolioFit(strategy, context, contract)
        val sAlign = outlookAlignment(strategy, context.outlook)

        fun w(key: String, default: Double): Double {
            val raw = prompt.weights[key] ?: default
            return if (raw > 0 && raw <= 1.0) raw else default
        }

        val wIv = w("iv_rank", W_IV)
        val wOi = w("oi", W_OI)
        val wVol = w("volume", W_VOL)
        val wLiq = w("liquidity", W_LIQ)
        val wPort = w("portfolio_fit", W_PORT)
        val wAlign = w("alignment", W_ALIGN)
        val sumW = wIv + wOi + wVol + wLiq + wPort + wAlign
        val norm = if (sumW > 0) sumW else 1.0

        val raw = 100.0 * (
            wIv * sIv + wOi * sOi + wVol * sVol + wLiq * sLiq + wPort * sPort + wAlign * sAlign
            ) / norm
        val score = min(100, max(0, raw.toInt()))
        val breakdown = mapOf(
            "S_iv" to sIv,
            "S_oi" to sOi,
            "S_vol" to sVol,
            "S_liq" to sLiq,
            "S_port" to sPort,
            "S_align" to sAlign,
            "weighted" to raw / 100.0,
        )
        return score to breakdown
    }

    fun buildOptionLegs(
        strategy: StrategyKind,
        chain: OptionChainSnapshot,
        primary: OptionContractSnapshot,
    ): List<OptionLeg> {
        val exp = chain.expirationYmd
        return when (strategy) {
            StrategyKind.CASH_SECURED_PUT -> listOf(
                OptionLeg("sell", "put", primary.strike, exp, 1),
            )
            StrategyKind.COVERED_CALL -> listOf(
                OptionLeg("sell", "call", primary.strike, exp, 1),
            )
            StrategyKind.PROTECTIVE_PUT, StrategyKind.LONG_PUT -> listOf(
                OptionLeg("buy", "put", primary.strike, exp, 1),
            )
            StrategyKind.LONG_CALL -> listOf(
                OptionLeg("buy", "call", primary.strike, exp, 1),
            )
            StrategyKind.BULL_PUT_SPREAD -> {
                val put = nearestPut(chain, primary.strike - 5.0) ?: primary
                listOf(
                    OptionLeg("sell", "put", primary.strike, exp, 1),
                    OptionLeg("buy", "put", put.strike, exp, 1),
                )
            }
            StrategyKind.BEAR_CALL_SPREAD -> {
                val call = nearestCall(chain, primary.strike + 5.0) ?: primary
                listOf(
                    OptionLeg("sell", "call", primary.strike, exp, 1),
                    OptionLeg("buy", "call", call.strike, exp, 1),
                )
            }
            StrategyKind.IRON_CONDOR, StrategyKind.LONG_STRADDLE -> listOf(
                OptionLeg("buy", "call", chain.calls.minByOrNull { abs(it.strike - chain.spot) }?.strike ?: primary.strike, exp, 1),
                OptionLeg("buy", "put", chain.puts.minByOrNull { abs(it.strike - chain.spot) }?.strike ?: primary.strike, exp, 1),
            )
        }
    }

    fun calculateRiskRewardMetrics(legs: List<OptionLeg>, midPrices: List<Double>): RiskRewardMetrics {
        if (legs.isEmpty() || legs.size != midPrices.size) {
            return RiskRewardMetrics(0.0, 0.0, 0.0, 50.0)
        }
        var maxProfit = 0.0
        var maxLoss = 0.0
        for (i in legs.indices) {
            val leg = legs[i]
            val px = midPrices[i]
            if (leg.side == "sell") {
                maxProfit += px * 100 * abs(leg.quantity)
            } else {
                maxLoss += px * 100 * abs(leg.quantity)
            }
        }
        val be = legs.firstOrNull()?.strike ?: 0.0
        val pop = (50 + (maxProfit / (maxLoss + 1e-6)) * 10).coerceIn(5.0, 95.0)
        return RiskRewardMetrics(maxProfit, maxLoss, be, pop)
    }

    fun generateRationale(
        strategy: StrategyKind,
        score: Int,
        breakdown: Map<String, Double>,
    ): String {
        val w = breakdown["weighted"] ?: 0.0
        return "Ranked $strategy (fit score $score, weighted=${"%.2f".format(w)}). " +
            "Drivers: IV ${"%.2f".format(breakdown["S_iv"] ?: 0.0)}, liquidity ${"%.2f".format(breakdown["S_liq"] ?: 0.0)}, " +
            "alignment ${"%.2f".format(breakdown["S_align"] ?: 0.0)}. Educational only; not financial advice."
    }

    fun generateRecommendations(
        context: UserOptionsContext,
        chainsByTicker: Map<String, OptionChainSnapshot>,
        prompt: OptionsScanPrompt,
    ): List<StrategyRecommendation> {
        val eligible = filterEligibleStrategies(context)
        val pref = prompt.preferredStrategies
        val strategies = if (pref.isNullOrEmpty()) eligible else eligible.filter { it in pref }
        val out = ArrayList<StrategyRecommendation>()
        for ((ticker, chain) in chainsByTicker) {
            val contracts = pickContractsForChain(chain, strategies)
            for ((strat, c) in contracts) {
                val (score, br) = calculateFitScore(strat, chain, c, context, prompt)
                if (score < prompt.minScore) continue
                val legs = buildOptionLegs(strat, chain, c)
                val mids = legs.map { legMid(chain, it) }
                val rr = calculateRiskRewardMetrics(legs, mids)
                out.add(
                    StrategyRecommendation(
                        strategy = strat,
                        underlying = ticker,
                        expirationYmd = chain.expirationYmd,
                        score = score,
                        scoreBreakdown = br,
                        legs = legs,
                        riskReward = rr,
                        rationale = generateRationale(strat, score, br),
                    ),
                )
            }
        }
        return out.sortedByDescending { it.score }
    }

    /**
     * JVM scheduled-task hook: runs a deterministic in-process demo so [daily_options_scanner] ticks
     * exercise the engine without Yahoo/Mongo (full chain fetch stays on Next.js task-runner when used).
     */
    fun scheduledTaskDryRunOutput(taskName: String): String {
        val demoChain = demoChain()
        val ctx = UserOptionsContext(
            risk = RiskTolerance.MODERATE,
            outlook = MarketOutlook.NEUTRAL,
            portfolioDeltaHint = 0.05,
        )
        val prompt = OptionsScanPrompt(minScore = 40, weights = emptyMap())
        val recs = generateRecommendations(ctx, mapOf("DEMO" to demoChain), prompt)
        val top = recs.firstOrNull()
        return "daily_options_scanner: OptionsStrategyEngine v1 task=\"$taskName\" " +
            "recommendations=${recs.size} top=${top?.strategy ?: "-"} score=${top?.score ?: 0}"
    }

    companion object {
        const val DEFAULT_MIN_SCORE = 70
        private const val W_IV = 0.30
        private const val W_OI = 0.20
        private const val W_VOL = 0.15
        private const val W_LIQ = 0.10
        private const val W_PORT = 0.15
        private const val W_ALIGN = 0.10

        fun normalizeIv(iv: Double): Double = (iv / 1.20).coerceIn(0.0, 1.0)

        fun normalizeOi(oi: Long): Double {
            if (oi <= 0L) return 0.0
            return (ln(oi + 1.0) / ln(5000.0)).coerceIn(0.0, 1.0)
        }

        fun normalizeVol(vol: Long): Double {
            if (vol <= 0L) return 0.0
            return (ln(vol + 1.0) / ln(2000.0)).coerceIn(0.0, 1.0)
        }

        fun liquidityScore(bid: Double, ask: Double, spot: Double): Double {
            if (bid <= 0 || ask <= 0 || spot <= 0) return 0.0
            val mid = (bid + ask) / 2.0
            val spr = (ask - bid) / mid.coerceAtLeast(1e-6)
            val sprPct = spr * 100.0
            return (1.0 - (sprPct / 25.0)).coerceIn(0.0, 1.0)
        }

        fun portfolioFit(
            strategy: StrategyKind,
            context: UserOptionsContext,
            contract: OptionContractSnapshot,
        ): Double {
            val d = contract.delta
            val hint = context.portfolioDeltaHint.coerceIn(-1.0, 1.0)
            val want: Double = when (strategy) {
                StrategyKind.COVERED_CALL, StrategyKind.CASH_SECURED_PUT -> -0.15
                StrategyKind.PROTECTIVE_PUT, StrategyKind.LONG_PUT -> -0.35
                StrategyKind.LONG_CALL -> 0.45
                else -> 0.0
            }
            val diff = 1.0 - abs(d - want) / 2.0
            val hintBonus = 1.0 - abs(hint - want) / 2.0
            return ((diff + hintBonus) / 2.0).coerceIn(0.0, 1.0)
        }

        fun outlookAlignment(strategy: StrategyKind, outlook: MarketOutlook): Double = when (outlook) {
            MarketOutlook.BULLISH -> when (strategy) {
                StrategyKind.COVERED_CALL, StrategyKind.CASH_SECURED_PUT,
                StrategyKind.BULL_PUT_SPREAD, StrategyKind.LONG_CALL,
                -> 1.0
                else -> 0.45
            }
            MarketOutlook.BEARISH -> when (strategy) {
                StrategyKind.PROTECTIVE_PUT, StrategyKind.BEAR_CALL_SPREAD, StrategyKind.LONG_PUT -> 1.0
                else -> 0.45
            }
            MarketOutlook.NEUTRAL -> when (strategy) {
                StrategyKind.IRON_CONDOR, StrategyKind.LONG_STRADDLE -> 1.0
                else -> 0.55
            }
        }

        private fun nearestPut(chain: OptionChainSnapshot, strike: Double): OptionContractSnapshot? =
            chain.puts.minByOrNull { abs(it.strike - strike) }

        private fun nearestCall(chain: OptionChainSnapshot, strike: Double): OptionContractSnapshot? =
            chain.calls.minByOrNull { abs(it.strike - strike) }

        private fun pickContractsForChain(
            chain: OptionChainSnapshot,
            strategies: List<StrategyKind>,
        ): List<Pair<StrategyKind, OptionContractSnapshot>> {
            val out = ArrayList<Pair<StrategyKind, OptionContractSnapshot>>()
            val atmC = chain.calls.minByOrNull { abs(it.strike - chain.spot) }
            val atmP = chain.puts.minByOrNull { abs(it.strike - chain.spot) }
            for (s in strategies) {
                when (s) {
                    StrategyKind.COVERED_CALL, StrategyKind.BEAR_CALL_SPREAD, StrategyKind.LONG_CALL ->
                        atmC?.let { out.add(s to it) }
                    StrategyKind.CASH_SECURED_PUT, StrategyKind.BULL_PUT_SPREAD, StrategyKind.PROTECTIVE_PUT, StrategyKind.LONG_PUT ->
                        atmP?.let { out.add(s to it) }
                    StrategyKind.IRON_CONDOR, StrategyKind.LONG_STRADDLE ->
                        atmC?.let { out.add(s to it) }
                }
            }
            return out
        }

        private fun legMid(chain: OptionChainSnapshot, leg: OptionLeg): Double {
            val src = if (leg.right == "call") chain.calls else chain.puts
            val c = src.firstOrNull { abs(it.strike - leg.strike) < 0.02 }
            return c?.let { (it.bid + it.ask) / 2.0 } ?: 1.0
        }

        private fun demoChain(): OptionChainSnapshot {
            val spot = 180.0
            val strikes = listOf(170.0, 175.0, 180.0, 185.0, 190.0)
            fun c(strike: Double, call: Boolean) = OptionContractSnapshot(
                strike = strike,
                impliedVol = 0.42,
                openInterest = 1200L,
                volume = 400L,
                bid = 2.10,
                ask = 2.30,
                delta = if (call) 0.52 else -0.48,
                isCall = call,
            )
            return OptionChainSnapshot(
                underlying = "DEMO",
                expirationYmd = "2030-01-18",
                spot = spot,
                calls = strikes.map { c(it, true) },
                puts = strikes.map { c(it, false) },
            )
        }
    }
}
