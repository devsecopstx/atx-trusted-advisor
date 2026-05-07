package com.atxfinance.backend.portfolio

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioStructuredSummaryTest {
    @Test
    fun `extracts holdings accounts and watchlist quotes`() {
        val payload =
            mapOf(
                "preload" to
                    mapOf(
                        "promptJson" to
                            mapOf(
                                "loadedAt" to "2026-05-07T12:00:00.000Z",
                                "workspaceContentRev" to 3,
                                "portfolio" to
                                    mapOf(
                                        "id" to "507f1f77bcf86cd799439011",
                                        "name" to "Main",
                                        "isDefault" to true,
                                        "totalPositionCount" to 5,
                                    ),
                                "positionsPreview" to
                                    listOf(
                                        mapOf("symbol" to "TSLA", "qty" to 10, "avgCost" to 200.0, "accountId" to "a1"),
                                        mapOf("symbol" to "AAPL", "qty" to 2, "avgCost" to 180.0, "accountId" to "a1"),
                                    ),
                                "positionsPreviewTruncated" to true,
                                "positionsOmittedCount" to 2,
                                "accounts" to
                                    listOf(
                                        mapOf(
                                            "accountId" to "a1",
                                            "name" to "Taxable",
                                            "cashBalance" to 1000,
                                            "positionCount" to 3,
                                            "isDefault" to true,
                                        ),
                                    ),
                                "watchlist" to
                                    mapOf(
                                        "name" to "WL",
                                        "symbols" to
                                            listOf(
                                                mapOf(
                                                    "symbol" to "NVDA",
                                                    "spotPriceDisplay" to "$120.00",
                                                    "targetEntryDisplay" to "$100",
                                                ),
                                            ),
                                    ),
                            ),
                        "positionsFull" to emptyList<Map<String, Any?>>(),
                    ),
                "workspaceContentRev" to 3,
                "materializedAt" to "2026-05-07T11:59:00.000Z",
                "source" to "warm",
            )

        val s = PortfolioStructuredSummary.fromWorkspacePayload(payload)
        assertNotNull(s)
        assertEquals("2026-05-07T12:00:00.000Z", s!!["lastUpdated"])

        @Suppress("UNCHECKED_CAST")
        val holdings = s["holdingsSummary"] as Map<*, *>
        assertEquals(5, holdings["totalPositionCount"])
        assertEquals(listOf("TSLA", "AAPL"), holdings["previewSymbols"])
        assertEquals(true, holdings["positionsPreviewTruncated"])
        assertEquals(2, holdings["positionsOmittedCount"])

        @Suppress("UNCHECKED_CAST")
        val balances = s["accountBalances"] as List<*>
        assertEquals(1, balances.size)
        @Suppress("UNCHECKED_CAST")
        val row = balances[0] as Map<*, *>
        assertEquals("a1", row["accountId"])
        assertEquals(1000.0, row["cashBalance"])

        @Suppress("UNCHECKED_CAST")
        val quotes = s["topQuotes"] as List<*>
        assertEquals(1, quotes.size)
        @Suppress("UNCHECKED_CAST")
        val q = quotes[0] as Map<*, *>
        assertEquals("NVDA", q["symbol"])
        assertEquals("$120.00", q["spotPriceDisplay"])
    }

    @Test
    fun `no_watchlist yields empty topQuotes`() {
        val payload =
            mapOf(
                "preload" to
                    mapOf(
                        "promptJson" to
                            mapOf(
                                "loadedAt" to "2026-05-07T12:00:00.000Z",
                                "portfolio" to mapOf("totalPositionCount" to 0),
                                "positionsPreview" to emptyList<Any>(),
                                "positionsPreviewTruncated" to false,
                                "positionsOmittedCount" to 0,
                                "accounts" to emptyList<Any>(),
                                "watchlist" to mapOf("error" to "no_watchlist"),
                            ),
                    ),
                "materializedAt" to "",
            )
        val s = PortfolioStructuredSummary.fromWorkspacePayload(payload)
        assertNotNull(s)
        @Suppress("UNCHECKED_CAST")
        val quotes = s!!["topQuotes"] as List<*>
        assertTrue(quotes.isEmpty())
    }

    @Test
    fun `missing preload returns null`() {
        assertEquals(null, PortfolioStructuredSummary.fromWorkspacePayload(mapOf("workspaceContentRev" to 0)))
    }
}
