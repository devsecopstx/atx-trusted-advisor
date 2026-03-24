package com.atxfinance.backend.portfolio

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.util.Date

/**
 * Ports `getDefaultPortfolio` + `provisionDefaultPortfolioForUser` from
 * `src/modules/core-admin/repository.ts`.
 */
@Service
class DefaultPortfolioProvisionService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    private val defaultPortfolioName = "Default Portfolio"
    private val defaultAccountName = "defaultaccount"
    private val defaultAccountRef = "ext_account_xref"
    private val defaultWatchlistName = "DefaultWatchlist"
    private val defaultWatchlistSymbol = "TSLA"

    fun getDefaultPortfolioDoc(session: ResolvedSession): Document? {
        val q = org.springframework.data.mongodb.core.query.BasicQuery(PortfolioMongoFilter.defaultPortfolioFilter(session))
        return mongoTemplate.findOne(q, Document::class.java, props.portfoliosCollection)
    }

    fun provision(
        session: ResolvedSession,
        watchlistSymbols: List<String> = listOf(defaultWatchlistSymbol),
    ): Triple<Document, Document, Document> {
        val userId = session.userId
        val now = Date()
        val tenantOid = PortfolioMongoFilter.tenantObjectId(session.tenantId)

        if (tenantOid != null) {
            mongoTemplate.updateMulti(
                Query.query(
                    Criteria().andOperator(
                        PortfolioMongoFilter.userIdCriteria(userId),
                        Criteria.where("isDefault").`is`(true),
                        Criteria().orOperator(
                            Criteria.where("tenantId").exists(false),
                            Criteria.where("tenantId").`is`(null),
                        ),
                    ),
                ),
                Update()
                    .set("tenantId", tenantOid)
                    .set("tenantPortfolioOrgKey", props.tenantPortfolioOrgKey)
                    .set("updatedAt", now),
                props.portfoliosCollection,
            )
        }

        val portfolioLookup = PortfolioMongoFilter.withTenantScopeCriteria(
            Criteria().andOperator(
                PortfolioMongoFilter.userIdCriteria(userId),
                Criteria.where("isDefault").`is`(true),
            ),
            session.tenantId,
        )
        var portfolio = mongoTemplate.findOne(
            Query.query(portfolioLookup),
            Document::class.java,
            props.portfoliosCollection,
        )

        val portfolioSet = Update()
            .set("name", defaultPortfolioName)
            .set("isDefault", true)
            .set("ext_broker_ref", props.defaultExtBrokerRef)
            .set("tenantPortfolioOrgKey", props.tenantPortfolioOrgKey)
            .set("updatedAt", now)
        if (tenantOid != null) {
            portfolioSet.set("tenantId", tenantOid)
        }

        if (portfolio?.getObjectId("_id") != null) {
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(portfolio!!.getObjectId("_id"))),
                portfolioSet,
                props.portfoliosCollection,
            )
        } else {
            val upsertCrit = PortfolioMongoFilter.strictWriteTenantCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(userId),
                    Criteria.where("isDefault").`is`(true),
                ),
                session.tenantId,
            )
            mongoTemplate.upsert(
                Query.query(upsertCrit),
                Update()
                    .setOnInsert("userId", userId)
                    .setOnInsert("createdAt", now)
                    .set("name", defaultPortfolioName)
                    .set("isDefault", true)
                    .set("ext_broker_ref", props.defaultExtBrokerRef)
                    .set("tenantPortfolioOrgKey", props.tenantPortfolioOrgKey)
                    .set("updatedAt", now)
                    .apply {
                        if (tenantOid != null) {
                            set("tenantId", tenantOid)
                        }
                    },
                props.portfoliosCollection,
            )
            portfolio = mongoTemplate.findOne(
                Query.query(portfolioLookup),
                Document::class.java,
                props.portfoliosCollection,
            )
        }

        if (portfolio?.getObjectId("_id") == null) {
            error("Failed to provision default portfolio")
        }

        if (portfolio!!["userId"] !is String) {
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(portfolio.getObjectId("_id"))),
                Update().set("userId", userId).set("updatedAt", now),
                props.portfoliosCollection,
            )
            portfolio = mongoTemplate.findById(portfolio.getObjectId("_id"), Document::class.java, props.portfoliosCollection)!!
        }

        val pid = portfolio.getObjectId("_id")!!

        if (tenantOid != null) {
            mongoTemplate.updateMulti(
                Query.query(
                    Criteria().andOperator(
                        PortfolioMongoFilter.userIdCriteria(userId),
                        Criteria.where("portfolioId").`is`(pid),
                        Criteria().orOperator(
                            Criteria.where("tenantId").exists(false),
                            Criteria.where("tenantId").`is`(null),
                        ),
                    ),
                ),
                Update().set("tenantId", tenantOid).set("updatedAt", now),
                props.accountsCollection,
            )
            mongoTemplate.updateMulti(
                Query.query(
                    Criteria().andOperator(
                        PortfolioMongoFilter.userIdCriteria(userId),
                        Criteria.where("portfolioId").`is`(pid),
                        Criteria().orOperator(
                            Criteria.where("tenantId").exists(false),
                            Criteria.where("tenantId").`is`(null),
                        ),
                    ),
                ),
                Update().set("tenantId", tenantOid).set("updatedAt", now),
                props.watchlistsCollection,
            )
        }

        val accountLookup = PortfolioMongoFilter.withTenantScopeCriteria(
            Criteria().andOperator(
                PortfolioMongoFilter.userIdCriteria(userId),
                Criteria.where("portfolioId").`is`(pid),
                Criteria.where("isDefault").`is`(true),
            ),
            session.tenantId,
        )
        var account = mongoTemplate.findOne(
            Query.query(accountLookup),
            Document::class.java,
            props.accountsCollection,
        )

        val accountSet = Update()
            .set("name", defaultAccountName)
            .set("type", "fidelity")
            .set("extAccountId", defaultAccountRef)
            .set("cashBalance", props.defaultAccountCashBalance)
            .set("isDefault", true)
            .set("updatedAt", now)
        if (tenantOid != null) {
            accountSet.set("tenantId", tenantOid)
        }

        if (account?.getObjectId("_id") != null) {
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(account!!.getObjectId("_id"))),
                accountSet,
                props.accountsCollection,
            )
        } else {
            val accUpsert = PortfolioMongoFilter.strictWriteTenantCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(userId),
                    Criteria.where("portfolioId").`is`(pid),
                    Criteria.where("isDefault").`is`(true),
                ),
                session.tenantId,
            )
            mongoTemplate.upsert(
                Query.query(accUpsert),
                Update()
                    .setOnInsert("userId", userId)
                    .setOnInsert("portfolioId", pid)
                    .setOnInsert("createdAt", now)
                    .set("name", defaultAccountName)
                    .set("type", "fidelity")
                    .set("extAccountId", defaultAccountRef)
                    .set("cashBalance", props.defaultAccountCashBalance)
                    .set("isDefault", true)
                    .set("updatedAt", now)
                    .apply {
                        if (tenantOid != null) {
                            set("tenantId", tenantOid)
                        }
                    },
                props.accountsCollection,
            )
            account = mongoTemplate.findOne(
                Query.query(accountLookup),
                Document::class.java,
                props.accountsCollection,
            )
        }

        if (account?.getObjectId("_id") == null) {
            error("Failed to provision default account")
        }

        if (account!!["userId"] !is String) {
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(account.getObjectId("_id"))),
                Update().set("userId", userId).set("updatedAt", now),
                props.accountsCollection,
            )
            account = mongoTemplate.findById(account.getObjectId("_id"), Document::class.java, props.accountsCollection)!!
        }

        // Cash backfill: scoped portfolio accounts with missing cashBalance
        val cashFilter = Criteria().andOperator(
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(userId),
                    Criteria.where("portfolioId").`is`(pid),
                ),
                session.tenantId,
            ),
            Criteria().orOperator(
                Criteria.where("cashBalance").exists(false),
                Criteria.where("cashBalance").`is`(null),
            ),
        )
        mongoTemplate.updateMulti(
            Query.query(cashFilter),
            Update().set("cashBalance", props.defaultAccountCashBalance).set("updatedAt", now),
            props.accountsCollection,
        )

        val wlLookup = PortfolioMongoFilter.withTenantScopeCriteria(
            Criteria().andOperator(
                PortfolioMongoFilter.userIdCriteria(userId),
                Criteria.where("portfolioId").`is`(pid),
            ),
            session.tenantId,
        )
        val existingWl = mongoTemplate.findOne(
            Query.query(wlLookup),
            Document::class.java,
            props.watchlistsCollection,
        )
        val seed = (listOf(defaultWatchlistSymbol) + watchlistSymbols.map { it.trim().uppercase() })
            .filter { it.isNotEmpty() }
            .distinct()
        val mergedSymbols = WatchlistSymbolCodec.normalizeDocumentSymbols(
            existingWl?.get("symbols"),
            seed,
        )
        val wlSet = Update()
            .set("name", defaultWatchlistName)
            .set("symbols", mergedSymbols)
            .set("isDefault", true)
            .set("updatedAt", now)
        if (tenantOid != null) {
            wlSet.set("tenantId", tenantOid)
        }

        if (existingWl?.getObjectId("_id") != null) {
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(existingWl.getObjectId("_id"))),
                wlSet,
                props.watchlistsCollection,
            )
        } else {
            val wlUpsert = PortfolioMongoFilter.strictWriteTenantCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(userId),
                    Criteria.where("portfolioId").`is`(pid),
                ),
                session.tenantId,
            )
            mongoTemplate.upsert(
                Query.query(wlUpsert),
                Update()
                    .setOnInsert("userId", userId)
                    .setOnInsert("portfolioId", pid)
                    .setOnInsert("createdAt", now)
                    .set("name", defaultWatchlistName)
                    .set("symbols", mergedSymbols)
                    .set("isDefault", true)
                    .set("updatedAt", now)
                    .apply {
                        if (tenantOid != null) {
                            set("tenantId", tenantOid)
                        }
                    },
                props.watchlistsCollection,
            )
        }

        var watchlist = mongoTemplate.findOne(
            Query.query(wlLookup),
            Document::class.java,
            props.watchlistsCollection,
        )
        if (watchlist?.getObjectId("_id") == null) {
            error("Failed to provision default watchlist")
        }
        if (watchlist!!["userId"] !is String) {
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(watchlist.getObjectId("_id"))),
                Update().set("userId", userId).set("updatedAt", now),
                props.watchlistsCollection,
            )
            watchlist = mongoTemplate.findById(watchlist.getObjectId("_id"), Document::class.java, props.watchlistsCollection)!!
        }

        return Triple(portfolio, account, watchlist)
    }

    /** Same as [provision] for an arbitrary user id (access-request approval path). */
    fun provisionForUser(userId: String, tenantId: String): Triple<Document, Document, Document> {
        val session =
            ResolvedSession(
                userId = userId,
                tenantId = tenantId,
                roles = emptyList(),
                email = null,
                username = null,
            )
        return provision(session)
    }
}
