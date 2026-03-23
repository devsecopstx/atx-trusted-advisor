package com.atxfinance.backend.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "app.atxfinance")
data class AtxfinanceProperties(
    val sessionCookieName: String = "xf_core_session",
    val portfoliosCollection: String = "tenant_portfolio",
    val accountsCollection: String = "portfolio_accounts",
    val watchlistsCollection: String = "portfolio_watchlists",
    val positionsCollection: String = "portfolio_positions",
    val defaultExtBrokerRef: String = "extBrokerName",
    val defaultAccountCashBalance: Double = 25_000.0,
    val tenantPortfolioOrgKey: String = "org-atx-finance",
    val maxWatchlistSymbols: Int = 75,
    val maxWatchlistSymbolsPerPatch: Int = 20,
)
