package com.atxfinance.backend.portfolio

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import com.mongodb.client.result.DeleteResult
import com.mongodb.client.result.UpdateResult
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.util.Date

@Service
class PositionsService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val portfolioCrud: PortfolioCrudService,
) {
    /**
     * Mirrors `requireAccountInPortfolio` + `listPortfolioAccounts` in Next.
     */
    fun accountInPortfolio(session: ResolvedSession, portfolioId: String, accountId: String): Boolean {
        val portfolioIdNorm = portfolioId.trim().lowercase()
        val accountIdNorm = accountId.trim().lowercase()
        if (!ObjectId.isValid(portfolioIdNorm) || !ObjectId.isValid(accountIdNorm)) {
            return false
        }
        val portfolio = portfolioCrud.findPortfolioForSessionUser(portfolioIdNorm, session) ?: return false
        val pid = portfolio.getObjectId("_id") ?: return false
        val accounts = portfolioCrud.listAccountsForPortfolio(pid, session)
        return accounts.any { it.getObjectId("_id")?.toHexString()?.lowercase() == accountIdNorm }
    }

    /** Caller must enforce `accountInPortfolio` first (matches Next `requireAccountInPortfolio` then list). */
    fun listPositionsForPortfolioAccount(
        session: ResolvedSession,
        portfolioId: String,
        accountId: String,
    ): List<Document> {
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(accountId)) {
            return emptyList()
        }
        val pid = ObjectId(portfolioId)
        val aid = ObjectId(accountId)
        val filter =
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(session.userId),
                    Criteria.where("portfolioId").`is`(pid),
                    Criteria.where("accountId").`is`(aid),
                ),
                session.tenantId,
            )
        return mongoTemplate.find(Query.query(filter), Document::class.java, props.positionsCollection)
    }

    fun upsert(
        session: ResolvedSession,
        normalized: PositionPayloadNormalizer.LegacyUpsert,
    ): Document {
        val portfolioIdStr = normalized.portfolioId
        val accountIdStr = normalized.accountId
        if (!ObjectId.isValid(portfolioIdStr) || !ObjectId.isValid(accountIdStr)) {
            throw PositionValidationException(
                PositionValidationException.Code.INVALID_IDS,
                "Invalid portfolioId or accountId",
            )
        }
        val portfolioId = ObjectId(portfolioIdStr)
        val accountId = ObjectId(accountIdStr)

        val accountFilter =
            PortfolioMongoFilter.portfolioFamilyReadTenantCriteria(
                Criteria().andOperator(
                    Criteria.where("_id").`is`(accountId),
                    PortfolioMongoFilter.userIdCriteria(session.userId),
                ),
                session.tenantId,
            )
        val account = mongoTemplate.findOne(Query.query(accountFilter), Document::class.java, props.accountsCollection)
        if (account == null || account.getObjectId("_id") == null) {
            throw PositionValidationException(
                PositionValidationException.Code.ACCOUNT_NOT_FOUND,
                "Account not found for user and tenant",
            )
        }
        val accPid = account["portfolioId"]
        val accPortfolioId =
            when (accPid) {
                is ObjectId -> accPid
                else -> null
            }
        if (accPortfolioId == null || accPortfolioId != portfolioId) {
            throw PositionValidationException(
                PositionValidationException.Code.ACCOUNT_PORTFOLIO_MISMATCH,
                "Account does not belong to the specified portfolio",
            )
        }
        val ext = (account.getString("extAccountId") ?: "").trim()
        if (ext.isEmpty()) {
            throw PositionValidationException(
                PositionValidationException.Code.ACCOUNT_MISSING_EXT_ACCOUNT_ID,
                "Account is missing extAccountId",
            )
        }

        val now = Date()
        val tenantOid = PortfolioMongoFilter.tenantObjectId(session.tenantId)
        val symbol = normalized.symbol.trim().uppercase()
        val posFilter =
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(session.userId),
                    Criteria.where("portfolioId").`is`(portfolioId),
                    Criteria.where("accountId").`is`(accountId),
                    Criteria.where("symbol").`is`(symbol),
                ),
                session.tenantId,
            )
        val update = Update()
        tenantOid?.let { update.setOnInsert("tenantId", it) }
        update
            .setOnInsert("createdAt", now)
            .set("userId", session.userId)
            .set("portfolioId", portfolioId)
            .set("accountId", accountId)
            .set("symbol", symbol)
            .set("qty", normalized.qty)
            .set("avgCost", normalized.avgCost)
            .set("updatedAt", now)

        mongoTemplate.upsert(Query.query(posFilter), update, props.positionsCollection)
        val saved =
            mongoTemplate.findOne(Query.query(posFilter), Document::class.java, props.positionsCollection)
                ?: error("Failed to upsert position")
        return saved
    }

    /**
     * Delete all positions for a portfolio account. Used by broker holdings import.
     */
    fun deleteAllForAccount(
        session: ResolvedSession,
        portfolioId: String,
        accountId: String,
    ): Long {
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(accountId)) {
            return 0L
        }
        val filter =
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(session.userId),
                    Criteria.where("portfolioId").`is`(ObjectId(portfolioId)),
                    Criteria.where("accountId").`is`(ObjectId(accountId)),
                ),
                session.tenantId,
            )
        val result: DeleteResult = mongoTemplate.remove(Query.query(filter), props.positionsCollection)
        return result.deletedCount
    }

    fun delete(
        session: ResolvedSession,
        portfolioId: String,
        accountId: String,
        positionId: String,
    ): Boolean {
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(accountId) || !ObjectId.isValid(positionId)) {
            return false
        }
        val filter =
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria().andOperator(
                    Criteria.where("_id").`is`(ObjectId(positionId)),
                    PortfolioMongoFilter.userIdCriteria(session.userId),
                    Criteria.where("portfolioId").`is`(ObjectId(portfolioId)),
                    Criteria.where("accountId").`is`(ObjectId(accountId)),
                ),
                session.tenantId,
            )
        val result: DeleteResult = mongoTemplate.remove(Query.query(filter), props.positionsCollection)
        return result.deletedCount == 1L
    }

    /**
     * Partial update (PATCH semantics) for an existing position row by its _id.
     * Used by the app-user holdings editor "change quantity / edit existing symbol" flow
     * to avoid symbol-based upsert when the user intends to mutate a specific holding.
     *
     * Only qty (>0), avgCost (>=0), and symbol are updatable. At least one must be provided.
     * Returns true if the position document was matched (and updated).
     */
    fun patch(
        session: ResolvedSession,
        portfolioId: String,
        accountId: String,
        positionId: String,
        qty: Double?,
        avgCost: Double?,
        symbol: String?,
    ): Boolean {
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(accountId) || !ObjectId.isValid(positionId)) {
            return false
        }
        val filter =
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria().andOperator(
                    Criteria.where("_id").`is`(ObjectId(positionId)),
                    PortfolioMongoFilter.userIdCriteria(session.userId),
                    Criteria.where("portfolioId").`is`(ObjectId(portfolioId)),
                    Criteria.where("accountId").`is`(ObjectId(accountId)),
                ),
                session.tenantId,
            )
        val update = Update()
        var hasField = false
        if (qty != null && qty > 0) {
            update.set("qty", qty)
            hasField = true
        }
        if (avgCost != null && avgCost >= 0) {
            update.set("avgCost", avgCost)
            hasField = true
        }
        if (!symbol.isNullOrBlank()) {
            update.set("symbol", symbol.trim().uppercase())
            hasField = true
        }
        if (!hasField) {
            return false
        }
        update.set("updatedAt", Date())

        val result: UpdateResult = mongoTemplate.updateFirst(Query.query(filter), update, props.positionsCollection)
        return result.matchedCount >= 1L
    }
}
