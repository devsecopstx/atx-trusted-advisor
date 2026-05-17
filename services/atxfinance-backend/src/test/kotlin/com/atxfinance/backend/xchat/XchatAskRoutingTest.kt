package com.atxfinance.backend.xchat

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class XchatAskRoutingTest {
    @Test
    fun `options scan intent matches natural language`() {
        assertTrue(XchatAskRouting.shouldRunOptionsActionScan("Scan my options from holdings + watchlist"))
        assertFalse(XchatAskRouting.shouldRunOptionsActionScan("What is a covered call?"))
    }

    @Test
    fun `watchlist intent excludes mutating asks`() {
        assertTrue(XchatAskRouting.isShowWatchlistIntent("show my watchlist"))
        assertFalse(XchatAskRouting.isShowWatchlistIntent("watchlist add TSLA"))
    }

    @Test
    fun `watchlist intent matches report summary details suffixes`() {
        assertTrue(XchatAskRouting.isShowWatchlistIntent("show my watchlist report"))
        assertTrue(XchatAskRouting.isShowWatchlistIntent("show my watchlist summary"))
        assertTrue(XchatAskRouting.isShowWatchlistIntent("show my watchlist details"))
    }

    @Test
    fun `watchlist intent normalizes extra whitespace and leading punctuation`() {
        assertTrue(XchatAskRouting.isShowWatchlistIntent("show my  watchlist"))
        assertTrue(XchatAskRouting.isShowWatchlistIntent(";show my watchlist"))
        assertTrue(XchatAskRouting.isShowWatchlistIntent("  show me my watchlist  "))
    }

    @Test
    fun `watchlist intent matches how my watchlist phrasing`() {
        assertTrue(XchatAskRouting.isShowWatchlistIntent("how my watchlist"))
        assertTrue(XchatAskRouting.isShowWatchlistIntent("how is my watchlist"))
        assertTrue(XchatAskRouting.isShowWatchlistIntent("what's on my watchlist"))
    }
}
