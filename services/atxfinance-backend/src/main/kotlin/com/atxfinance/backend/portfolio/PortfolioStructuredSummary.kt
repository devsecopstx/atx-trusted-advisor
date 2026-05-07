package com.atxfinance.backend.portfolio

/**
 * Denormalized fields derived from materialized workspace preload (`data.preload`) for observability
 * and light clients. Matches [WorkspaceSnapshotPromptJson] / preload shape produced by Next materialization.
 */
object PortfolioStructuredSummary {
    private const val TOP_QUOTES_CAP = 15

    @Suppress("UNCHECKED_CAST")
    fun fromWorkspacePayload(payload: Map<String, Any?>): Map<String, Any?>? {
        val preload = payload["preload"] ?: return null
        val preloadMap = preload as? Map<*, *> ?: return null
        val promptJson = preloadMap["promptJson"] as? Map<*, *> ?: return null

        val loadedAt = promptJson["loadedAt"]?.toString()?.trim().orEmpty()
        val materializedAt = payload["materializedAt"]?.toString()?.trim().orEmpty()
        val lastUpdated = loadedAt.ifEmpty { materializedAt }

        val portfolio = promptJson["portfolio"] as? Map<*, *>
        val totalPositionCount = intOf(portfolio?.get("totalPositionCount")) ?: 0

        val positionsPreview = promptJson["positionsPreview"] as? List<*>
        val previewSymbols =
            positionsPreview?.mapNotNull { row ->
                val m = row as? Map<*, *> ?: return@mapNotNull null
                m["symbol"]?.toString()?.trim()?.takeIf { it.isNotEmpty() }
            }.orEmpty()

        val previewTruncated = promptJson["positionsPreviewTruncated"] as? Boolean ?: false
        val positionsOmittedCount = intOf(promptJson["positionsOmittedCount"]) ?: 0

        val accounts = promptJson["accounts"] as? List<*>
        val accountBalances =
            accounts?.mapNotNull { row ->
                val m = row as? Map<*, *> ?: return@mapNotNull null
                mapOf(
                    "accountId" to (m["accountId"]?.toString() ?: ""),
                    "name" to (m["name"]?.toString() ?: ""),
                    "cashBalance" to (doubleOf(m["cashBalance"]) ?: 0.0),
                    "positionCount" to (intOf(m["positionCount"]) ?: 0),
                    "isDefault" to (m["isDefault"] as? Boolean ?: false),
                )
            }.orEmpty()

        val watchlist = promptJson["watchlist"]
        val topQuotes = extractTopQuotes(watchlist)

        return mapOf(
            "lastUpdated" to lastUpdated,
            "holdingsSummary" to
                mapOf(
                    "totalPositionCount" to totalPositionCount,
                    "previewSymbolCount" to previewSymbols.size,
                    "previewSymbols" to previewSymbols,
                    "positionsPreviewTruncated" to previewTruncated,
                    "positionsOmittedCount" to positionsOmittedCount,
                ),
            "accountBalances" to accountBalances,
            "topQuotes" to topQuotes,
        )
    }

    @Suppress("UNCHECKED_CAST")
    private fun extractTopQuotes(watchlist: Any?): List<Map<String, Any?>> {
        if (watchlist !is Map<*, *>) {
            return emptyList()
        }
        if (watchlist.containsKey("error")) {
            return emptyList()
        }
        val symbols = watchlist["symbols"] as? List<*> ?: return emptyList()
        return symbols.asSequence().take(TOP_QUOTES_CAP).mapNotNull { sym ->
            val sm = sym as? Map<*, *> ?: return@mapNotNull null
            val symbol = sm["symbol"]?.toString()?.trim().orEmpty()
            if (symbol.isEmpty()) {
                return@mapNotNull null
            }
            mapOf(
                "symbol" to symbol,
                "spotPriceDisplay" to sm["spotPriceDisplay"],
                "targetEntryDisplay" to sm["targetEntryDisplay"],
                "targetEntryNotional100xDisplay" to sm["targetEntryNotional100xDisplay"],
            )
        }.toList()
    }

    private fun intOf(v: Any?): Int? =
        when (v) {
            is Number -> v.toInt()
            is String -> v.toIntOrNull()
            else -> null
        }

    private fun doubleOf(v: Any?): Double? =
        when (v) {
            is Number -> v.toDouble()
            is String -> v.toDoubleOrNull()
            else -> null
        }
}
