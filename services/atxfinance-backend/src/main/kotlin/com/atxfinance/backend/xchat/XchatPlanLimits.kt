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

    /** Mirrors `getPlanLimits(...).maxToolCalls` in `src/modules/xchat/plan-limits.ts`. */
    fun maxToolCallsForPlan(plan: String?): Int =
        when (normalizePlanSlug(plan)) {
            "premium_plus" -> 20
            "premium" -> 10
            else -> 2
        }

    fun normalizePlanSlug(raw: String?): String {
        val n = raw?.trim()?.lowercase().orEmpty()
        if (n.isEmpty()) {
            return "basic"
        }
        return when (n) {
            "basic" -> "basic"
            "free" -> "basic"
            "premium" -> "premium"
            "pro" -> "premium"
            "premium_monthly" -> "premium"
            "premium_plus", "premium-plus", "premium+", "premium_plus_monthly", "premium_plus_yearly" -> "premium_plus"
            "enterprise" -> "premium_plus"
            else -> "basic"
        }
    }
}
