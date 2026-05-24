package com.atxfinance.backend.strategy

import org.springframework.core.env.Environment
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import kotlin.math.abs

/**
 * Local-dev option chains when Yahoo is unavailable (Hot Picks + strategy recommendations).
 * Never used in production profiles unless [isDevOrTestProfile] is true.
 */
object OptionsDevChainFallback {
    fun isDevOrTestProfile(environment: Environment): Boolean {
        val profiles = environment.activeProfiles.map { it.lowercase() }.toSet()
        if (profiles.contains("dev") || profiles.contains("development") || profiles.contains("test")) {
            return true
        }
        return isDevDeployTarget()
    }

    fun isDevOrTestProfile(): Boolean = isDevDeployTarget() ||
        (System.getProperty("spring.profiles.active") ?: "")
            .split(",")
            .map { it.trim().lowercase() }
            .any { it in setOf("dev", "development", "test") }

    private fun isDevDeployTarget(): Boolean {
        val deployTarget =
            (System.getenv("ATX_DEPLOY_TARGET") ?: System.getenv("DEPLOY_TARGET") ?: "")
                .trim()
                .lowercase()
        return deployTarget == "dev" || deployTarget == "local"
    }

    fun syntheticChain(symbol: String, horizonDays: Int): OptionsStrategyEngine.OptionChainSnapshot {
        val spot = 100.0
        val expiration =
            LocalDate.now(ZoneOffset.UTC)
                .plusDays(horizonDays.toLong().coerceIn(1, 120))
                .format(DateTimeFormatter.ISO_LOCAL_DATE)
        val strikes = listOf(90.0, 95.0, 100.0, 105.0, 110.0)
        fun contract(strike: Double, isCall: Boolean) =
            OptionsStrategyEngine.OptionContractSnapshot(
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
            underlying = symbol.trim().uppercase(),
            expirationYmd = expiration,
            spot = spot,
            calls = strikes.map { contract(it, true) },
            puts = strikes.map { contract(it, false) },
        )
    }

    private fun estimateDelta(spot: Double, strike: Double, isCall: Boolean): Double {
        val moneyness = (spot - strike) / spot
        return if (isCall) {
            (0.5 + moneyness).coerceIn(0.05, 0.95)
        } else {
            (-0.5 + moneyness).coerceIn(-0.95, -0.05)
        }
    }
}
