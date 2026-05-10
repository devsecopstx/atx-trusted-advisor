package com.atxfinance.backend.portfolio

import org.bson.Document
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class TenantBootstrapPolicyResolverTest {
    @Test
    fun viewerDefaultPolicySkipsPortfolio() {
        val d = TenantBootstrapPolicyResolver.resolve(listOf("viewer"), Document())
        assertFalse(d.provisionPortfolio)
        assertNull(d.watchlistSeedList)
    }

    @Test
    fun operatorGetsPortfolioAndDeskSeeds() {
        val d = TenantBootstrapPolicyResolver.resolve(listOf("operator"), Document())
        assertTrue(d.provisionPortfolio)
        assertEquals(listOf("TSLA", "NVDA", "AAPL", "AMD"), d.watchlistSeedList)
    }

    @Test
    fun watchlistSeedSymbolsFromTenantPreferences() {
        val tp =
            Document(
                mapOf(
                    "watchlist_seed_symbols" to listOf("META", "googl"),
                ),
            )
        val d = TenantBootstrapPolicyResolver.resolve(listOf("advisor"), tp)
        assertTrue(d.provisionPortfolio)
        assertEquals(listOf("META", "GOOGL"), d.watchlistSeedList)
    }

    @Test
    fun legacyBootstrapFalseSkipsAllRoles() {
        val tp = Document(mapOf("bootstrap_default_portfolio_watchlist" to false))
        val d = TenantBootstrapPolicyResolver.resolve(listOf("operator"), tp)
        assertFalse(d.provisionPortfolio)
    }

    @Test
    fun explicitBootstrapPolicyViewerPortfolioTrue() {
        val policy =
            Document(
                mapOf(
                    "defaultPortfolio" to
                        Document(
                            mapOf(
                                "viewer" to true,
                                "operator" to true,
                                "advisor" to true,
                            ),
                        ),
                    "defaultWatchlist" to
                        Document(
                            mapOf(
                                "viewer" to true,
                                "operator" to true,
                                "advisor" to true,
                            ),
                        ),
                    "overrides" to emptyList<Document>(),
                ),
            )
        val tp = Document(mapOf("bootstrap_policy" to policy))
        val d = TenantBootstrapPolicyResolver.resolve(listOf("viewer"), tp)
        assertTrue(d.provisionPortfolio)
        assertNotNull(d.watchlistSeedList)
    }

    @Test
    fun globalAdminOnlyWithoutPlatformRoleSkips() {
        val d = TenantBootstrapPolicyResolver.resolve(listOf("global_admin"), Document())
        assertFalse(d.provisionPortfolio)
    }

    @Test
    fun advisorRoleWinsOverViewer() {
        val d = TenantBootstrapPolicyResolver.resolve(listOf("viewer", "advisor"), Document())
        assertTrue(d.provisionPortfolio)
    }
}
