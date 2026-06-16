package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PortfolioCrudService
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.stereotype.Component
import kotlin.math.abs

/** Portfolio-linked holdings scan for ProfitFinder (qty, cost basis, unrealized P&L). */
@Component
class ProfitFinderPortfolioScanner(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val portfolioCrud: PortfolioCrudService,
    private val yahooClient: StrategyOptionsYahooClient,
) {
    data class HoldingRow(
        val symbol: String,
        val qty: Double,
        val avgCost: Double,
        val accountId: String,
        val spotPrice: Double?,
        val costBasis: Double,
        val marketValue: Double?,
        val unrealizedPnl: Double?,
        val unrealizedPnlPercent: Double?,
        val source: String,
    )

    data class ScanResult(
        val portfolioId: String,
        val holdings: List<HoldingRow>,
        val watchlistSymbols: List<String>,
        val ibkrConsentGranted: Boolean,
        val portfolioDeltaHint: Double,
    )

    fun scan(
        session: ResolvedSession,
        portfolioIdHex: String,
        includeWatchlist: Boolean,
        symbolFilter: Set<String>?,
    ): ScanResult? {
        if (!ObjectId.isValid(portfolioIdHex)) {
            return null
        }
        val portfolio = portfolioCrud.findPortfolioForSessionUser(portfolioIdHex, session) ?: return null
        val portfolioOid = portfolio.getObjectId("_id") ?: return null

        val accountFilter =
            Criteria.where("portfolioId").`is`(portfolioOid)
                .and("tenantId").`is`(ObjectId(session.tenantId))
                .and("userId").`is`(ObjectId(session.userId))
        val accounts =
            mongoTemplate.find(
                Query.query(accountFilter),
                Document::class.java,
                props.accountsCollection,
            )
        val accountIds = accounts.mapNotNull { it.getObjectId("_id") }
        if (accountIds.isEmpty()) {
            return ScanResult(
                portfolioId = portfolioOid.toHexString(),
                holdings = emptyList(),
                watchlistSymbols = if (includeWatchlist) loadWatchlistSymbols(session) else emptyList(),
                ibkrConsentGranted = hasIbkrConsent(session),
                portfolioDeltaHint = 0.0,
            )
        }

        val posFilter =
            Criteria.where("accountId").`in`(accountIds)
                .and("tenantId").`is`(ObjectId(session.tenantId))
        val positions =
            mongoTemplate.find(
                Query.query(posFilter),
                Document::class.java,
                props.positionsCollection,
            )

        val bySymbol = linkedMapOf<String, MutableList<HoldingRow>>()
        var netLongShares = 0.0
        var totalAbsShares = 0.0

        for (p in positions) {
            val sym = p.getString("symbol")?.trim()?.uppercase() ?: continue
            if (!SYMBOL_REGEX.matches(sym)) continue
            if (symbolFilter != null && sym !in symbolFilter) continue
            val qty = (p["qty"] as? Number)?.toDouble() ?: continue
            if (abs(qty) < 1e-9) continue
            val avgCost = (p["avgCost"] as? Number)?.toDouble() ?: 0.0
            val accountId = p.getObjectId("accountId")?.toHexString() ?: ""
            val spot = yahooClient.fetchUnderlyingQuote(sym)?.get("regularMarketPrice") as? Double
            val costBasis = avgCost * abs(qty)
            val marketValue = spot?.let { it * abs(qty) }
            val unrealizedPnl =
                if (spot != null && avgCost > 0) {
                    (spot - avgCost) * qty
                } else {
                    null
                }
            val unrealizedPnlPercent =
                if (unrealizedPnl != null && costBasis > 0) {
                    (unrealizedPnl / costBasis) * 100.0
                } else {
                    null
                }
            val row =
                HoldingRow(
                    symbol = sym,
                    qty = qty,
                    avgCost = avgCost,
                    accountId = accountId,
                    spotPrice = spot,
                    costBasis = costBasis,
                    marketValue = marketValue,
                    unrealizedPnl = unrealizedPnl,
                    unrealizedPnlPercent = unrealizedPnlPercent,
                    source = "portfolio",
                )
            bySymbol.getOrPut(sym) { mutableListOf() }.add(row)
            if (qty > 0) {
                netLongShares += qty
            }
            totalAbsShares += abs(qty)
        }

        val merged =
            bySymbol.map { (sym, rows) ->
                if (rows.size == 1) {
                    rows.first()
                } else {
                    val totalQty = rows.sumOf { it.qty }
                    val weightedAvg =
                        if (abs(totalQty) > 1e-9) {
                            rows.sumOf { it.avgCost * abs(it.qty) } / rows.sumOf { abs(it.qty) }
                        } else {
                            rows.first().avgCost
                        }
                    val spot = rows.firstOrNull()?.spotPrice
                    val costBasis = weightedAvg * abs(totalQty)
                    val unrealizedPnl =
                        if (spot != null) {
                            (spot - weightedAvg) * totalQty
                        } else {
                            null
                        }
                    HoldingRow(
                        symbol = sym,
                        qty = totalQty,
                        avgCost = weightedAvg,
                        accountId = rows.joinToString(",") { it.accountId }.take(128),
                        spotPrice = spot,
                        costBasis = costBasis,
                        marketValue = spot?.let { it * abs(totalQty) },
                        unrealizedPnl = unrealizedPnl,
                        unrealizedPnlPercent =
                            if (unrealizedPnl != null && costBasis > 0) {
                                (unrealizedPnl / costBasis) * 100.0
                            } else {
                                null
                            },
                        source = "portfolio",
                    )
                }
            }.sortedByDescending { it.costBasis }

        val watchlist =
            if (includeWatchlist) {
                loadWatchlistSymbols(session).filter { sym ->
                    symbolFilter == null || sym in symbolFilter
                }
            } else {
                emptyList()
            }

        val deltaHint =
            if (totalAbsShares > 0) {
                (netLongShares / totalAbsShares).coerceIn(-1.0, 1.0)
            } else {
                0.0
            }

        return ScanResult(
            portfolioId = portfolioOid.toHexString(),
            holdings = merged,
            watchlistSymbols = watchlist.filter { sym -> merged.none { it.symbol == sym } },
            ibkrConsentGranted = hasIbkrConsent(session),
            portfolioDeltaHint = deltaHint,
        )
    }

    private fun loadWatchlistSymbols(session: ResolvedSession): List<String> {
        val q = Query.query(PortfolioMongoFilter.watchlistSessionReadCriteria(session))
        val doc = mongoTemplate.findOne(q, Document::class.java, props.watchlistsCollection) ?: return emptyList()
        val symbols = doc.getList("symbols", Document::class.java) ?: return emptyList()
        return symbols.mapNotNull { it.getString("symbol")?.trim()?.uppercase() }
            .filter { SYMBOL_REGEX.matches(it) }
    }

    private fun hasIbkrConsent(session: ResolvedSession): Boolean {
        val uid = runCatching { ObjectId(session.userId) }.getOrNull() ?: return false
        val tenantOid = runCatching { ObjectId(session.tenantId) }.getOrNull() ?: return false
        val filter =
            Criteria.where("userId").`is`(uid)
                .and("tenantId").`is`(tenantOid)
                .and("consentAcceptedAt").exists(true)
        val doc =
            mongoTemplate.findOne(
                Query.query(filter),
                Document::class.java,
                IBKR_USER_CONSENTS_COLLECTION,
            )
        return doc != null
    }

    companion object {
        private val SYMBOL_REGEX = Regex("^[A-Z0-9.\\-]{1,12}$")
        const val IBKR_USER_CONSENTS_COLLECTION = "ibkr_user_consents"
    }
}