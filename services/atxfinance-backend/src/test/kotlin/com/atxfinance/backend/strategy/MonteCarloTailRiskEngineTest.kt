package com.atxfinance.backend.strategy

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock
import org.springframework.beans.factory.ObjectProvider
import org.springframework.data.redis.core.StringRedisTemplate
import kotlin.random.Random

class MonteCarloTailRiskEngineTest {

    @Suppress("UNCHECKED_CAST")
    private fun engineNoRedis(): MonteCarloTailRiskEngine {
        val om: ObjectProvider<ObjectMapper> = mock(ObjectProvider::class.java) as ObjectProvider<ObjectMapper>
        val redis: ObjectProvider<StringRedisTemplate> =
            mock(ObjectProvider::class.java) as ObjectProvider<StringRedisTemplate>
        `when`(om.ifAvailable).thenReturn(ObjectMapper())
        `when`(redis.ifAvailable).thenReturn(null)
        return MonteCarloTailRiskEngine(om, redis)
    }

    @Test
    fun `vol spike stress dominates base VaR`() {
        val engine = engineNoRedis()
        val chain = sampleChain("TSLA", 200.0)
        val ctx = OptionsStrategyEngine.UserOptionsContext(
            risk = OptionsStrategyEngine.RiskTolerance.MODERATE,
            outlook = OptionsStrategyEngine.MarketOutlook.NEUTRAL,
        )
        val holdings = listOf(PortfolioHoldingSnapshot("TSLA", 1.0))
        val summary = engine.evaluateBook(
            ctx,
            mapOf("TSLA" to chain),
            holdings,
            pathCount = 8000,
            random = Random(42),
        )!!
        assertTrue(summary.stress2020VolSpike.var1dPct >= summary.var1dPct95 * 1.5)
    }

    @Test
    fun `correlation crush raises joint tail loss vs base on two-name book`() {
        val engine = engineNoRedis()
        val c1 = sampleChain("TSLA", 200.0)
        val c2 = sampleChain("RDW", 15.0)
        val ctx = OptionsStrategyEngine.UserOptionsContext(
            risk = OptionsStrategyEngine.RiskTolerance.AGGRESSIVE,
            outlook = OptionsStrategyEngine.MarketOutlook.BULLISH,
        )
        val holdings = listOf(
            PortfolioHoldingSnapshot("TSLA", 0.6),
            PortfolioHoldingSnapshot("RDW", 0.4),
        )
        val summary = engine.evaluateBook(
            ctx,
            mapOf("TSLA" to c1, "RDW" to c2),
            holdings,
            pathCount = 9000,
            random = Random(7),
        )!!
        assertTrue(summary.stressCorrelationCrush.var10dPct >= summary.var10dPct95)
    }

    private fun sampleChain(symbol: String, spot: Double): OptionsStrategyEngine.OptionChainSnapshot {
        val strikes = listOf(spot * 0.95, spot, spot * 1.05)
        fun leg(strike: Double, call: Boolean) = OptionsStrategyEngine.OptionContractSnapshot(
            strike = strike,
            impliedVol = 0.55,
            openInterest = 1000L,
            volume = 100L,
            bid = 2.0,
            ask = 2.2,
            delta = if (call) 0.5 else -0.5,
            isCall = call,
        )
        return OptionsStrategyEngine.OptionChainSnapshot(
            underlying = symbol,
            expirationYmd = "2030-12-20",
            spot = spot,
            calls = strikes.map { leg(it, true) },
            puts = strikes.map { leg(it, false) },
        )
    }
}
