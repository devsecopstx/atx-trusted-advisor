package com.atxfinance.backend.xchat

/**
 * Mirrors `src/modules/xchat/plan-limits.ts` defaults used when tenant workspace caps are unset.
 */
object XchatPlanLimits {
    fun maxPromptsPerDay(plan: String?): Int =
        when (plan?.trim()?.lowercase()) {
            "premium" -> 200
            "premium_plus", "premium-plus" -> 2000
            else -> 5
        }
}
