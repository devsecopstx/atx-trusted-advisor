package com.atxfinance.backend.strategy

import com.atxfinance.backend.strategy.OptionsStrategyEngine.Companion.liquidityScore
import com.atxfinance.backend.strategy.OptionsStrategyEngine.Companion.normalizeIv
import com.atxfinance.backend.strategy.OptionsStrategyEngine.Companion.normalizeOi
import com.atxfinance.backend.strategy.OptionsStrategyEngine.Companion.normalizeVol
import com.atxfinance.backend.strategy.OptionsStrategyEngine.Companion.portfolioFit
import com.atxfinance.backend.strategy.OptionsStrategyEngine.MarketOutlook
import com.atxfinance.backend.strategy.OptionsStrategyEngine.OptionChainSnapshot
import com.atxfinance.backend.strategy.OptionsStrategyEngine.OptionContractSnapshot
import com.atxfinance.backend.strategy.OptionsStrategyEngine.OptionsScanPrompt
import com.atxfinance.backend.strategy.OptionsStrategyEngine.RiskTolerance
import com.atxfinance.backend.strategy.OptionsStrategyEngine.StrategyKind
import com.atxfinance.backend.strategy.OptionsStrategyEngine.UserOptionsContext
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class OptionsStrategyEngineTest {

    private val engine = OptionsStrategyEngine()

    @Test
    fun `empty chains yields no recommendations`() {
        val ctx = UserOptionsContext(RiskTolerance.MODERATE, MarketOutlook.BULLISH)
        val recs = engine.generateRecommendations(ctx, emptyMap(), OptionsScanPrompt(minScore = 0))
        assertEquals(0, recs.size)
    }

    @Test
    fun `fit score respects weight overrides`() {
        val chain = sampleChain()
        val c = chain.calls.first()
        val ctx = UserOptionsContext(RiskTolerance.MODERATE, MarketOutlook.NEUTRAL)
        val lowIv = engine.calculateFitScore(
            StrategyKind.IRON_CONDOR,
            chain,
            c.copy(impliedVol = 0.10),
            ctx,
            OptionsScanPrompt(weights = mapOf("iv_rank" to 0.90)),
        )
        val highIv = engine.calculateFitScore(
            StrategyKind.IRON_CONDOR,
            chain,
            c.copy(impliedVol = 0.95),
            ctx,
            OptionsScanPrompt(weights = mapOf("iv_rank" to 0.90)),
        )
        assertTrue(lowIv.first < highIv.first)
    }

    @Test
    fun `minScore filters recommendations`() {
        val chain = sampleChain()
        val ctx = UserOptionsContext(RiskTolerance.MODERATE, MarketOutlook.NEUTRAL)
        val all = engine.generateRecommendations(ctx, mapOf("X" to chain), OptionsScanPrompt(minScore = 0))
        val high = engine.generateRecommendations(ctx, mapOf("X" to chain), OptionsScanPrompt(minScore = 99))
        assertTrue(all.isNotEmpty())
        assertEquals(0, high.size)
    }

    @Test
    fun `recommendations include engine-grounded narrative fields`() {
        val chain = sampleChain()
        val ctx = UserOptionsContext(RiskTolerance.MODERATE, MarketOutlook.BULLISH)
        val recs = engine.generateRecommendations(ctx, mapOf("SMP" to chain), OptionsScanPrompt(minScore = 0))
        val top = recs.first()

        assertEquals("SMP", top.underlying)
        assertTrue(top.score in 0..100)
        assertTrue(top.legs.isNotEmpty())
        assertTrue(top.riskReward.popApproxPercent in 5.0..95.0)
        assertTrue(top.rationale.contains("fit score"))
        assertTrue(top.rationale.contains("Educational only"))
    }

    @Test
    fun `normalizers are bounded zero to one`() {
        assertEquals(0.0, normalizeIv(-1.0), 0.001)
        assertTrue(normalizeIv(0.6) in 0.0..1.0)
        assertTrue(normalizeOi(100L) in 0.0..1.0)
        assertTrue(normalizeVol(50L) in 0.0..1.0)
        assertTrue(liquidityScore(2.0, 2.1, 100.0) in 0.0..1.0)
    }

    @Test
    fun `portfolioFit is bounded`() {
        val c = OptionContractSnapshot(
            strike = 100.0,
            impliedVol = 0.3,
            openInterest = 500,
            volume = 100,
            bid = 1.0,
            ask = 1.1,
            delta = 0.5,
            isCall = true,
        )
        val v = portfolioFit(StrategyKind.LONG_CALL, UserOptionsContext(RiskTolerance.MODERATE, MarketOutlook.BULLISH), c)
        assertTrue(v in 0.0..1.0)
    }

    @Test
    fun `dry run output mentions engine`() {
        val out = engine.scheduledTaskDryRunOutput("t1")
        assertTrue(out.contains("OptionsStrategyEngine"))
        assertTrue(out.contains("recommendations="))
    }

    private fun sampleChain(): OptionChainSnapshot {
        val spot = 100.0
        val strikes = listOf(95.0, 100.0, 105.0)
        fun leg(strike: Double, call: Boolean) = OptionContractSnapshot(
            strike = strike,
            impliedVol = 0.35,
            openInterest = 800L,
            volume = 200L,
            bid = 1.5,
            ask = 1.7,
            delta = if (call) 0.5 else -0.5,
            isCall = call,
        )
        return OptionChainSnapshot(
            underlying = "SMP",
            expirationYmd = "2030-06-20",
            spot = spot,
            calls = strikes.map { leg(it, true) },
            puts = strikes.map { leg(it, false) },
        )
    }
}
