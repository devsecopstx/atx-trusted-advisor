package com.atxfinance.backend.portfolio

import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.springframework.stereotype.Service

@Service
class DefaultPortfolioApiService(
    private val provisionService: DefaultPortfolioProvisionService,
    private val portfolioCrud: PortfolioCrudService,
) {

    fun loadSummaryPayload(session: ResolvedSession): Map<String, Any?> {
        var portfolio = provisionService.getDefaultPortfolioDoc(session)
        if (portfolio == null) {
            portfolio = provisionService.provision(session, listOf("TSLA")).first
        }
        val pid = portfolio.getObjectId("_id")
            ?: error("Default portfolio missing id")
        if (portfolioCrud.listAccountsForPortfolio(pid, session).isEmpty()) {
            provisionService.provision(session, listOf("TSLA"))
            portfolio = provisionService.getDefaultPortfolioDoc(session)
                ?: error("Default portfolio not found after provision")
        }
        return portfolioCrud.buildSummaryPayload(portfolio, session)
    }
}
