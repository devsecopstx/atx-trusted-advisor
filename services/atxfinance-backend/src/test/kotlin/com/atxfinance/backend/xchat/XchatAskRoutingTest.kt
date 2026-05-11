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
}
