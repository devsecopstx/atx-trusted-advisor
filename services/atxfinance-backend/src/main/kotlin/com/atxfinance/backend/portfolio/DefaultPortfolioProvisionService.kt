package com.atxfinance.backend.portfolio

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import java.util.Date

/**
 * Ports `getDefaultPortfolio` + `provisionDefaultPortfolioForUser` from
 * `src/modules/core-admin/repository.ts`. Repeat [provision] does not reset
 * `extAccountId` or `type` on an existing default account (insert/upsert path still seeds defaults).
 */
@Service
class DefaultPortfolioProvisionService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    private val coreTenantsCollection = "core_tenants"
    private val defaultTenantSlug = "atxfinance-core"

    private val defaultPortfolioName = "Default Portfolio"
    private val defaultAccountName = "defaultaccount"
    private val defaultAccountRef = "ext_account_xref"
    private val defaultWatchlistName = "DefaultWatchlist"
    private val defaultWatchlistSymbol = "TSLA"
    private val defaultAccountRiskProfile = "balanced"
    private val defaultAccountOutlook = "neutral"

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

        val portfolioSetExisting = Update()
            .set("isDefault", true)
            .set("ext_broker_ref", props.defaultExtBrokerRef)
            .set("tenantPortfolioOrgKey", props.tenantPortfolioOrgKey)
            .set("updatedAt", now)
        if (tenantOid != null) {
            portfolioSetExisting.set("tenantId", tenantOid)
        }

        if (portfolio?.getObjectId("_id") != null) {
            val pidExisting = portfolio!!.getObjectId("_id")!!
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(pidExisting)),
                portfolioSetExisting,
                props.portfoliosCollection,
            )
            val existingPortfolioName = (portfolio.getString("name") ?: "").trim()
            if (existingPortfolioName.isEmpty()) {
                mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").`is`(pidExisting)),
                    Update().set("name", defaultPortfolioName).set("updatedAt", Date()),
                    props.portfoliosCollection,
                )
            }
            portfolio =
                mongoTemplate.findById(pidExisting, Document::class.java, props.portfoliosCollection)
                    ?: error("Failed to reload portfolio after provision")
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

        // Idempotent re-provision: do not reset broker `type` or `extAccountId` on an existing default
        // account (matches Next `provisionDefaultPortfolioForUser` — user-set refs survive OAuth / shell).
        val accountSetExisting =
            Update()
                .set("isDefault", true)
                .set("updatedAt", now)
                .apply {
                    if (tenantOid != null) {
                        set("tenantId", tenantOid)
                    }
                }

        if (account?.getObjectId("_id") != null) {
            val aid = account!!.getObjectId("_id")!!
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(aid)),
                accountSetExisting,
                props.accountsCollection,
            )
            val existingAccountName = (account.getString("name") ?: "").trim()
            if (existingAccountName.isEmpty()) {
                mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").`is`(aid)),
                    Update().set("name", defaultAccountName).set("updatedAt", Date()),
                    props.accountsCollection,
                )
            }
            account =
                mongoTemplate.findById(aid, Document::class.java, props.accountsCollection)
                    ?: error("Failed to reload account after provision")
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
                    .setOnInsert("name", defaultAccountName)
                    .setOnInsert("type", "fidelity")
                    .setOnInsert("extAccountId", defaultAccountRef)
                    .setOnInsert("cashBalance", props.defaultAccountCashBalance)
                    .setOnInsert("riskProfile", defaultAccountRiskProfile)
                    .setOnInsert("outlook", defaultAccountOutlook)
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

        val defaultAccountDeskBase =
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(userId),
                    Criteria.where("portfolioId").`is`(pid),
                    Criteria.where("isDefault").`is`(true),
                ),
                session.tenantId,
            )
        mongoTemplate.updateMulti(
            Query.query(
                Criteria().andOperator(
                    defaultAccountDeskBase,
                    Criteria().orOperator(
                        Criteria.where("riskProfile").exists(false),
                        Criteria.where("riskProfile").`is`(null),
                    ),
                ),
            ),
            Update().set("riskProfile", defaultAccountRiskProfile).set("updatedAt", now),
            props.accountsCollection,
        )
        mongoTemplate.updateMulti(
            Query.query(
                Criteria().andOperator(
                    defaultAccountDeskBase,
                    Criteria().orOperator(
                        Criteria.where("outlook").exists(false),
                        Criteria.where("outlook").`is`(null),
                    ),
                ),
            ),
            Update().set("outlook", defaultAccountOutlook).set("updatedAt", now),
            props.accountsCollection,
        )

        val wlLookup = PortfolioMongoFilter.watchlistReadCriteriaForUser(userId, session.tenantId)
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
        val wlSetExisting = Update()
            .set("symbols", mergedSymbols)
            .set("isDefault", true)
            .set("updatedAt", now)
        if (tenantOid != null) {
            wlSetExisting.set("tenantId", tenantOid)
        }

        if (existingWl?.getObjectId("_id") != null) {
            val wlid = existingWl.getObjectId("_id")!!
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(wlid)),
                wlSetExisting,
                props.watchlistsCollection,
            )
            val existingWlName = (existingWl.getString("name") ?: "").trim()
            if (existingWlName.isEmpty()) {
                mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").`is`(wlid)),
                    Update().set("name", defaultWatchlistName).set("updatedAt", Date()),
                    props.watchlistsCollection,
                )
            }
        } else {
            val wlUpsert = PortfolioMongoFilter.watchlistStrictUpsertCriteriaForUser(userId, session.tenantId)
            mongoTemplate.upsert(
                Query.query(wlUpsert),
                Update()
                    .setOnInsert("userId", userId)
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

    /**
     * Same as [provision] for an arbitrary user id, respecting tenant `tenantPreferences` bootstrap
     * policy (aligned with Next `ensureTenantBootstrapForUser`). Returns null when policy skips portfolio
     * or user has no viewer/operator/advisor role.
     */
    fun provisionForUser(userId: String, tenantId: String): Triple<Document, Document, Document>? {
        val uid = userId.trim()
        val tid = tenantId.trim()
        if (!ObjectId.isValid(uid) || !ObjectId.isValid(tid)) {
            error("Invalid userId or tenantId for provisionForUser")
        }
        val userDoc =
            mongoTemplate.findById(ObjectId(uid), Document::class.java, props.coreUsersCollection)
                ?: error("User not found for provisionForUser")
        val tenantDoc =
            mongoTemplate.findById(ObjectId(tid), Document::class.java, coreTenantsCollection)
        val roles =
            (userDoc["roles"] as? List<*>)?.mapNotNull { it?.toString()?.trim() }?.filter { it.isNotEmpty() }
                ?: emptyList()
        val prefs = tenantDoc?.get("tenantPreferences", Document::class.java)
        val decision = TenantBootstrapPolicyResolver.resolve(roles, prefs)
        if (!decision.provisionPortfolio) {
            log.info("[provision] skipped by tenant bootstrap policy userId={} tenantId={}", uid, tid)
            return null
        }
        val seeds = decision.watchlistSeedList ?: listOf(defaultWatchlistSymbol)
        val session =
            ResolvedSession(
                userId = uid,
                tenantId = tid,
                roles = roles,
                email = userDoc.getString("email"),
                username = null,
            )
        return provision(session, seeds)
    }

    /**
     * Access-request approval: provision the applicant's default book under **their** default tenant
     * membership (or platform default tenant), never the approving admin's session tenant.
     */
    fun provisionForAccessRequestApprovedUser(userId: String): Triple<Document, Document, Document>? {
        val tenantHex = resolveTenantIdForApprovedUserPortfolio(userId)
        return provisionForUser(userId, tenantHex)
    }

    private fun resolveTenantIdForApprovedUserPortfolio(userId: String): String {
        val oid =
            try {
                ObjectId(userId)
            } catch (_: IllegalArgumentException) {
                error("Invalid user id for portfolio tenant resolution")
            }
        val mem =
            mongoTemplate.findOne(
                Query.query(
                    Criteria.where("userId").`is`(oid).and("isDefaultTenant").`is`(true),
                ),
                Document::class.java,
                props.coreTenantMembershipsCollection,
            )
        mem?.getObjectId("tenantId")?.toHexString()?.let {
            return it
        }
        val tenant =
            mongoTemplate.findOne(
                Query.query(Criteria.where("slug").`is`(defaultTenantSlug)),
                Document::class.java,
                coreTenantsCollection,
            ) ?: error("core default tenant missing (slug=$defaultTenantSlug)")
        return tenant.getObjectId("_id")!!.toHexString()
    }
}
