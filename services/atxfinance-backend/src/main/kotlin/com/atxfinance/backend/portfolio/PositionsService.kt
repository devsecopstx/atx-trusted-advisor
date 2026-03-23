package com.atxfinance.backend.portfolio

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import com.mongodb.client.result.DeleteResult
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
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(accountId)) {
            return false
        }
        val portfolio = portfolioCrud.findPortfolioForSessionUser(portfolioId, session) ?: return false
        val pid = portfolio.getObjectId("_id") ?: return false
        val accounts = portfolioCrud.listAccountsForPortfolio(pid, session)
        return accounts.any { it.getObjectId("_id")?.toHexString() == accountId }
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
            PortfolioMongoFilter.withTenantScopeCriteria(
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
}
