package com.atxfinance.backend.xchat

import java.util.Locale

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

    fun normalizeXchatUserMessageForRouting(message: String): String =
        message
            .trim()
            .replace(Regex("^[^a-zA-Z0-9]+"), "")
            .lowercase()
            .replace(Regex("\\s+"), " ")

    fun isShowWatchlistIntent(message: String): Boolean {
        val normalized = normalizeXchatUserMessageForRouting(message)
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
                normalized.contains("what is in my watchlist") ||
                normalized.contains("how is my watchlist") ||
                normalized.contains("how my watchlist") ||
                Regex("\\bwatchlist\\s+(report|summary|table|details)\\b").containsMatchIn(normalized) ||
                Regex("\\b(show|list|view|see|display|how)\\s+(me\\s+)?(my|our)\\s+watchlist\\b").containsMatchIn(normalized) ||
                Regex("\\bwhat(?:'s| is)\\s+on\\s+(my|our)\\s+watchlist\\b").containsMatchIn(normalized)
        )
    }

    private val directQuoteTicker = Regex("^[a-z0-9.^-]{1,10}$")

    fun isDirectTickerQuoteIntent(message: String): Boolean {
        val normalized = normalizeXchatUserMessageForRouting(message)
        if (normalized.isEmpty() || normalized.length > 120) {
            return false
        }
        if (
            Regex("\\b(watchlist|portfolio|holdings?|options?\\s+chain|strike|expir)\\b").containsMatchIn(normalized)
        ) {
            return false
        }
        if (
            Regex("^[a-z0-9.^-]{1,10}\\s+quote\\b").containsMatchIn(normalized) ||
                Regex("\\bquote\\s+(for|on)\\s+[a-z0-9.^-]{1,10}\\b").containsMatchIn(normalized) ||
                Regex("\\b(?:price|quote)\\s+for\\s+[a-z0-9.^-]{1,10}\\b").containsMatchIn(normalized) ||
                Regex("\\b(?:get|show|what(?:'s| is))\\s+(?:the\\s+)?(?:live\\s+)?quote\\s+(?:for|on)\\s+[a-z0-9.^-]{1,10}\\b")
                    .containsMatchIn(normalized)
        ) {
            return true
        }
        if (normalized.length <= 96 && Regex("\\bquote\\b").containsMatchIn(normalized)) {
            return extractTickerCandidates(message, 2).size == 1
        }
        return false
    }

    private val tickerCandidateStop =
        setOf(
            "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HER", "WAS", "ONE", "OUR", "OUT",
            "DAY", "GET", "HAS", "HIM", "HIS", "HOW", "ITS", "MAY", "NEW", "NOW", "OLD", "SEE", "TWO", "WAY",
            "WHO", "QUOTE", "PRICE",
        )

    private fun extractTickerCandidates(message: String, max: Int): List<String> {
        val upper = message.uppercase(Locale.ROOT)
        val re = Regex("\\b[A-Z][A-Z0-9.]{0,9}\\b")
        val found = ArrayList<String>()
        val seen = LinkedHashSet<String>()
        for (match in re.findAll(upper)) {
            val w = match.value
            if (w.length !in 1..10 || w in tickerCandidateStop || seen.contains(w)) {
                continue
            }
            seen.add(w)
            found.add(w)
            if (found.size >= max) {
                break
            }
        }
        return found
    }

    fun extractDirectQuoteSymbol(message: String): String? {
        if (!isDirectTickerQuoteIntent(message)) {
            return null
        }
        val normalized = normalizeXchatUserMessageForRouting(message)
        Regex("^([a-z0-9.^-]{1,10})\\s+quote\\b").find(normalized)?.groupValues?.getOrNull(1)?.let {
            if (directQuoteTicker.matches(it)) {
                return it.uppercase(Locale.ROOT)
            }
        }
        Regex("\\bquote\\s+(?:for|on)\\s+([a-z0-9.^-]{1,10})\\b").find(normalized)?.groupValues?.getOrNull(1)?.let {
            if (directQuoteTicker.matches(it)) {
                return it.uppercase(Locale.ROOT)
            }
        }
        Regex("\\b(?:price|quote)\\s+for\\s+([a-z0-9.^-]{1,10})\\b").find(normalized)?.groupValues?.getOrNull(1)?.let {
            if (directQuoteTicker.matches(it)) {
                return it.uppercase(Locale.ROOT)
            }
        }
        return extractTickerCandidates(message, 2).singleOrNull()
    }
}
