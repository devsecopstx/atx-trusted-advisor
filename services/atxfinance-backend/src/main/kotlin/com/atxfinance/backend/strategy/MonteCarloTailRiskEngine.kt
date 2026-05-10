package com.atxfinance.backend.strategy

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.security.MessageDigest
import java.time.Duration
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt
import kotlin.random.Random

/** Equity notionals as fraction of book (sum ≈ 1). Symbols missing from chains use a default annual vol. */
data class PortfolioHoldingSnapshot(
    val symbol: String,
    val weight: Double,
)

data class TailRiskStressSlice(
    val label: String,
    /** Positive fraction — magnitude of loss at ~95% historical loss side for 1 trading day. */
    val var1dPct: Double,
    val var10dPct: Double,
    val cvar1dPct: Double,
    val probDrawdownGt20Pct: Double,
)

/**
 * Book-level Monte Carlo tail metrics (fat tails + jumps). Percent fields are **positive** magnitudes
 * for VaR/CVaR (loss vs starting value); probabilities are in [0,1].
 */
data class TailRiskSummary(
    val paths: Int,
    val var1dPct95: Double,
    val var10dPct95: Double,
    val cvar1dPct95: Double,
    val cvar10dPct95: Double,
    val probDrawdownGt20Pct: Double,
    val stress2020VolSpike: TailRiskStressSlice,
    val stressCorrelationCrush: TailRiskStressSlice,
    val riskTierNote: String,
    val hedgeOverlayHint: String,
)

/**
 * Companion to [OptionsStrategyEngine]: Student-t / jump-diffusion Monte Carlo on a correlated equity book,
 * using ATM IV from each [OptionsStrategyEngine.OptionChainSnapshot]. Results cached in Redis (5m TTL) when available.
 */
@Component
class MonteCarloTailRiskEngine(
    private val objectMapperProvider: ObjectProvider<ObjectMapper>,
    @Qualifier("cacheRedisTemplate")
    private val redisProvider: ObjectProvider<StringRedisTemplate>,
) {

    fun evaluateBook(
        context: OptionsStrategyEngine.UserOptionsContext,
        chainsByTicker: Map<String, OptionsStrategyEngine.OptionChainSnapshot>,
        holdings: List<PortfolioHoldingSnapshot>,
        pathCount: Int = DEFAULT_PATHS,
        random: Random = Random.Default,
    ): TailRiskSummary? {
        val normalized = normalizeHoldings(holdings)
        if (normalized.isEmpty()) {
            return null
        }
        val paths = pathCount.coerceIn(MIN_PATHS, MAX_PATHS)
        val cacheKey = redisCacheKey(context.risk, normalized, chainsByTicker, paths)
        val redis = redisProvider.ifAvailable
        val om = objectMapperProvider.ifAvailable
        if (redis != null && om != null) {
            try {
                val cached = redis.opsForValue().get(cacheKey)
                if (!cached.isNullOrBlank()) {
                    return om.readValue(cached, TailRiskSummary::class.java)
                }
            } catch (_: Exception) {
                /* compute fresh */
            }
        }

        val assets = buildAssets(normalized, chainsByTicker)
        if (assets.isEmpty()) {
            return null
        }

        val base = runScenario(
            assets = assets,
            rho = RHO_BASE,
            volMultiplier = 1.0,
            paths = paths,
            random = random,
        )
        val stressVol = runScenario(
            assets = assets,
            rho = RHO_BASE,
            volMultiplier = VOL_SPIKE_2020,
            paths = min(paths, STRESS_PATH_CAP),
            random = Random(random.nextLong()),
        )
        val stressRho = runScenario(
            assets = assets,
            rho = RHO_CORRELATION_CRUSH,
            volMultiplier = 1.0,
            paths = min(paths, STRESS_PATH_CAP),
            random = Random(random.nextLong()),
        )

        val (note, hedge) = riskTierGuidance(context.risk, base.cvar1dPct95)
        val summary = TailRiskSummary(
            paths = paths,
            var1dPct95 = base.var1dPct95,
            var10dPct95 = base.var10dPct95,
            cvar1dPct95 = base.cvar1dPct95,
            cvar10dPct95 = base.cvar10dPct95,
            probDrawdownGt20Pct = base.probDrawdownGt20Pct,
            stress2020VolSpike = TailRiskStressSlice(
                label = "2020_style_vol_spike",
                var1dPct = stressVol.var1dPct95,
                var10dPct = stressVol.var10dPct95,
                cvar1dPct = stressVol.cvar1dPct95,
                probDrawdownGt20Pct = stressVol.probDrawdownGt20Pct,
            ),
            stressCorrelationCrush = TailRiskStressSlice(
                label = "correlation_crush",
                var1dPct = stressRho.var1dPct95,
                var10dPct = stressRho.var10dPct95,
                cvar1dPct = stressRho.cvar1dPct95,
                probDrawdownGt20Pct = stressRho.probDrawdownGt20Pct,
            ),
            riskTierNote = note,
            hedgeOverlayHint = hedge,
        )

        if (redis != null && om != null) {
            try {
                redis.opsForValue().set(cacheKey, om.writeValueAsString(summary), Duration.ofSeconds(CACHE_TTL_SECONDS))
            } catch (_: Exception) {
                /* ignore */
            }
        }
        return summary
    }

    private data class AssetParams(
        val symbol: String,
        val weight: Double,
        val sigmaAnnual: Double,
    )

    private data class ScenarioStats(
        val var1dPct95: Double,
        val var10dPct95: Double,
        val cvar1dPct95: Double,
        val cvar10dPct95: Double,
        val probDrawdownGt20Pct: Double,
    )

    private fun runScenario(
        assets: List<AssetParams>,
        rho: Double,
        volMultiplier: Double,
        paths: Int,
        random: Random,
    ): ScenarioStats {
        val n = assets.size
        val w = DoubleArray(n) { assets[it].weight }
        val sigma = DoubleArray(n) { assets[it].sigmaAnnual * volMultiplier }
        val rhoC = rho.coerceIn(0.0, 0.99)
        val sqrtRho = sqrt(rhoC)
        val sqrtOne = sqrt(1.0 - rhoC)

        val dt = 1.0 / TRADING_DAYS_PER_YEAR
        val sqrtDt = sqrt(dt)
        val lambdaDt = LAMBDA_JUMPS_ANNUAL / TRADING_DAYS_PER_YEAR

        val ret1d = DoubleArray(paths)
        val ret10d = DoubleArray(paths)
        val dd10 = DoubleArray(paths)

        val nu = NU_STUDENT_T

        for (p in 0 until paths) {
            val r1 = oneStepReturn(w, sigma, sqrtDt, lambdaDt, nu, sqrtRho, sqrtOne, random)
            ret1d[p] = r1

            var wealth = 1.0
            var peak = 1.0
            var maxDd = 0.0
            repeat(HORIZON_DAYS_10) {
                val r = oneStepReturn(w, sigma, sqrtDt, lambdaDt, nu, sqrtRho, sqrtOne, random)
                wealth *= (1.0 + r)
                peak = max(peak, wealth)
                maxDd = max(maxDd, (peak - wealth) / peak.coerceAtLeast(1e-12))
            }
            ret10d[p] = wealth - 1.0
            dd10[p] = maxDd
        }

        ret1d.sort()
        ret10d.sort()
        val q05_1 = percentile(ret1d, 0.05)
        val q05_10 = percentile(ret10d, 0.05)
        val var1d = lossPctFromQuantileReturn(q05_1)
        val var10 = lossPctFromQuantileReturn(q05_10)
        val cvar1d = cvarFromReturns(ret1d, q05_1)
        val cvar10 = cvarFromReturns(ret10d, q05_10)
        val probDd = dd10.count { it > DRAWDOWN_THRESHOLD }.toDouble() / paths.toDouble()

        return ScenarioStats(
            var1dPct95 = var1d,
            var10dPct95 = var10,
            cvar1dPct95 = cvar1d,
            cvar10dPct95 = cvar10,
            probDrawdownGt20Pct = probDd,
        )
    }

    private fun oneStepReturn(
        w: DoubleArray,
        sigma: DoubleArray,
        sqrtDt: Double,
        lambdaDt: Double,
        nu: Int,
        sqrtRho: Double,
        sqrtOne: Double,
        random: Random,
    ): Double {
        val f = random.nextStudentTStd(nu)
        var sum = 0.0
        for (i in w.indices) {
            val eps = random.nextStudentTStd(nu)
            val z = sqrtRho * f + sqrtOne * eps
            var r = sigma[i] * sqrtDt * z
            if (random.nextDouble() < lambdaDt) {
                r += exp(JUMP_MEAN_LOG + JUMP_SIGMA_LOG * random.nextGaussian()) - 1.0
            }
            sum += w[i] * r
        }
        return sum
    }

    private fun lossPctFromQuantileReturn(q05: Double): Double {
        // q05 is the 5th percentile portfolio return (negative is loss). VaR-like loss magnitude (positive %).
        return max(0.0, -q05 * 100.0)
    }

    private fun cvarFromReturns(sortedAsc: DoubleArray, q05: Double): Double {
        var s = 0.0
        var c = 0
        for (x in sortedAsc) {
            if (x <= q05) {
                s += x
                c++
            }
        }
        if (c == 0) {
            return lossPctFromQuantileReturn(q05)
        }
        val meanTail = s / c
        return max(0.0, -meanTail * 100.0)
    }

    private fun percentile(sorted: DoubleArray, p: Double): Double {
        if (sorted.isEmpty()) {
            return 0.0
        }
        val idx = ((sorted.size - 1) * p).toInt().coerceIn(0, sorted.size - 1)
        return sorted[idx]
    }

    private fun buildAssets(
        holdings: List<PortfolioHoldingSnapshot>,
        chains: Map<String, OptionsStrategyEngine.OptionChainSnapshot>,
    ): List<AssetParams> {
        val out = ArrayList<AssetParams>()
        for (h in holdings) {
            val sym = h.symbol.trim().uppercase()
            if (sym.isEmpty()) continue
            val chain = chains[sym]
            val sigma = resolveSigmaAnnual(chain)
            out.add(AssetParams(sym, h.weight, sigma))
        }
        return out
    }

    private fun resolveSigmaAnnual(chain: OptionsStrategyEngine.OptionChainSnapshot?): Double {
        if (chain == null) {
            return DEFAULT_SIGMA
        }
        val iv = atmImpliedVol(chain).coerceIn(0.05, 2.5)
        return iv
    }

    private fun atmImpliedVol(chain: OptionsStrategyEngine.OptionChainSnapshot): Double {
        val atmC = chain.calls.minByOrNull { abs(it.strike - chain.spot) }
        val atmP = chain.puts.minByOrNull { abs(it.strike - chain.spot) }
        val vals = listOfNotNull(atmC?.impliedVol, atmP?.impliedVol).filter { it > 0.01 }
        if (vals.isEmpty()) {
            return DEFAULT_SIGMA
        }
        return vals.average()
    }

    private fun normalizeHoldings(raw: List<PortfolioHoldingSnapshot>): List<PortfolioHoldingSnapshot> {
        val cleaned = raw.map { PortfolioHoldingSnapshot(it.symbol.trim().uppercase(), max(0.0, it.weight)) }
            .filter { it.symbol.isNotBlank() && it.weight > 0 }
        val sum = cleaned.sumOf { it.weight }
        if (sum <= 1e-12) {
            return emptyList()
        }
        return cleaned.map { PortfolioHoldingSnapshot(it.symbol, it.weight / sum) }
    }

    private fun redisCacheKey(
        risk: OptionsStrategyEngine.RiskTolerance,
        holdings: List<PortfolioHoldingSnapshot>,
        chains: Map<String, OptionsStrategyEngine.OptionChainSnapshot>,
        paths: Int,
    ): String {
        val payload = buildString {
            append(risk.name)
            append("|")
            append(paths)
            append("|")
            holdings.sortedBy { it.symbol }.forEach { append(it.symbol); append(":"); append("%.6f".format(it.weight)); append(";") }
            append("|")
            chains.keys.sorted().forEach { sym ->
                val c = chains[sym] ?: return@forEach
                append(sym)
                append("@")
                append(c.expirationYmd)
                append("@")
                append("%.4f".format(c.spot))
                append("@")
                append("%.4f".format(atmImpliedVol(c)))
                append(";")
            }
        }
        val digest = MessageDigest.getInstance("SHA-256").digest(payload.toByteArray(Charsets.UTF_8))
        val hex = digest.joinToString("") { b -> "%02x".format(b) }
        return "xf:tailrisk:v1:$hex"
    }


    companion object {
        const val DEFAULT_PATHS: Int = 20_000
        private const val MIN_PATHS = 5_000
        private const val MAX_PATHS = 50_000
        private const val CACHE_TTL_SECONDS = 300L
        private const val TRADING_DAYS_PER_YEAR = 252.0
        private const val NU_STUDENT_T = 6
        private const val RHO_BASE = 0.35
        private const val RHO_CORRELATION_CRUSH = 0.85
        private const val VOL_SPIKE_2020 = 2.5
        private const val LAMBDA_JUMPS_ANNUAL = 1.5
        private const val JUMP_MEAN_LOG = -0.03
        private const val JUMP_SIGMA_LOG = 0.06
        private const val DEFAULT_SIGMA = 0.45
        private const val HORIZON_DAYS_10 = 10
        private const val DRAWDOWN_THRESHOLD = 0.20
        private const val STRESS_PATH_CAP = 12_000

        internal fun riskTierGuidance(
            risk: OptionsStrategyEngine.RiskTolerance,
            cvar1dPct: Double,
        ): Pair<String, String> {
            val capFrac = when (risk) {
                OptionsStrategyEngine.RiskTolerance.CONSERVATIVE -> 0.08
                OptionsStrategyEngine.RiskTolerance.MODERATE -> 0.12
                OptionsStrategyEngine.RiskTolerance.AGGRESSIVE -> 0.18
            }
            val capPct = capFrac * 100.0
            val breach = cvar1dPct / 100.0 > capFrac
            val note = if (!breach) {
                "Tail CVaR is within your ${risk.name.lowercase()} budget (~${"%.0f".format(capPct)}% 1D CVaR cap)."
            } else {
                "Tail CVaR exceeds ${risk.name.lowercase()} budget (~${"%.0f".format(capPct)}% 1D CVaR cap) — trim concentration or add hedges."
            }
            val hedge = when (risk) {
                OptionsStrategyEngine.RiskTolerance.CONSERVATIVE ->
                    "Overlay bias: protective puts / collars on top weights; tighten income strikes only after tail sleeve is sized."
                OptionsStrategyEngine.RiskTolerance.MODERATE ->
                    "Overlay bias: put spreads or lightweight index hedge vs largest single-name gaps."
                OptionsStrategyEngine.RiskTolerance.AGGRESSIVE ->
                    "Overlay bias: ratio spreads or convex sleeve if single-name beta stacks (e.g. high-beta miners / mega-cap tech)."
            }
            return note to hedge
        }

        fun appendTailRiskToRationale(
            baseRationale: String,
            summary: TailRiskSummary?,
            risk: OptionsStrategyEngine.RiskTolerance,
        ): String {
            if (summary == null) {
                return baseRationale
            }
            val capPct = when (risk) {
                OptionsStrategyEngine.RiskTolerance.CONSERVATIVE -> 8
                OptionsStrategyEngine.RiskTolerance.MODERATE -> 12
                OptionsStrategyEngine.RiskTolerance.AGGRESSIVE -> 18
            }
            val sfx = buildString {
                append(" Book tail-risk (MC ")
                append(summary.paths)
                append(" paths, fat-tail+jumps): 1D VaR95≈")
                append("%.2f".format(summary.var1dPct95))
                append("%, 10D VaR95≈")
                append("%.2f".format(summary.var10dPct95))
                append("%, 1D CVaR95≈")
                append("%.2f".format(summary.cvar1dPct95))
                append("%, P(10d DD>20%)≈")
                append("%.1f".format(summary.probDrawdownGt20Pct * 100.0))
                append("%. Stress ")
                append(summary.stress2020VolSpike.label)
                append(" 1D VaR95≈")
                append("%.2f".format(summary.stress2020VolSpike.var1dPct))
                append("%. ")
                append(summary.riskTierNote)
                append(" (")
                append(capPct)
                append("% CVaR guardrail). ")
                append(summary.hedgeOverlayHint)
            }
            return baseRationale.trimEnd() + sfx
        }
    }
}

private fun Random.nextGaussian(): Double {
    repeat(12) {
        val u1 = nextDouble().coerceAtLeast(1e-12)
        val u2 = nextDouble()
        val r = sqrt(-2.0 * ln(u1)) * cos(2.0 * kotlin.math.PI * u2)
        if (r.isFinite()) {
            return r
        }
    }
    return 0.0
}

private fun Random.nextStudentT(nu: Int): Double {
    val z = nextGaussian()
    var chi = 0.0
    repeat(nu) {
        val g = nextGaussian()
        chi += g * g
    }
    return z / sqrt(chi / nu.toDouble())
}

private fun Random.nextStudentTStd(nu: Int): Double {
    require(nu > 2)
    val t = nextStudentT(nu)
    val scale = sqrt(nu.toDouble() / (nu - 2))
    return t / scale
}
