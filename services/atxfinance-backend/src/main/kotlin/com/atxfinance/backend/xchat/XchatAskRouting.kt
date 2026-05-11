package com.atxfinance.backend.xchat

/**
 * Mirrors `src/modules/xchat/xchat-ask-routing.ts` for direct deterministic routes on the JVM stream path.
 */
object XchatAskRouting {
    fun shouldRunOptionsActionScan(message: String): Boolean {
        val m = message.trim().lowercase()
        if (m.isEmpty()) {
            return false
        }
        if (m == "options_scan" || m == "/options_scan") {
            return true
        }
        val patterns =
            listOf(
                Regex("\\bscan my options\\b"),
                Regex("\\bcheck my options holdings\\b"),
                Regex("\\boptions health check\\b"),
                Regex("\\bscan options holdings\\b"),
                Regex("\\boptions action scan\\b"),
                Regex("\\bwhat should i do with my options\\b"),
            )
        return patterns.any { it.containsMatchIn(m) }
    }

    fun isShowWatchlistIntent(message: String): Boolean {
        val normalized = message.trim().lowercase()
        if (normalized.isEmpty()) {
            return false
        }
        if (
            normalized.contains("add ") ||
            normalized.contains("remove ") ||
            normalized.contains("delete ") ||
            normalized.contains("watchlist add") ||
            normalized.contains("watchlist remove")
        ) {
            return false
        }
        return (
            normalized == "show my watchlist" ||
                normalized == "my watchlist" ||
                normalized.contains("show watchlist") ||
                normalized.contains("show my watchlist") ||
                normalized.contains("list my watchlist") ||
                normalized.contains("what is in my watchlist")
        )
    }
}
