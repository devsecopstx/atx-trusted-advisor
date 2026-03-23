package com.atxfinance.backend.portfolio

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.Date

@Service
class PortfolioCrudService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {

    fun findPortfolioForSessionUser(portfolioId: String, session: ResolvedSession): Document? {
        if (!ObjectId.isValid(portfolioId)) {
            return null
        }
        val criteria = portfolioAccessCriteria(ObjectId(portfolioId), session)
        return mongoTemplate.findOne(
            Query.query(criteria),
            Document::class.java,
            props.portfoliosCollection,
        )
    }

    fun listAccountsForPortfolio(portfolioId: ObjectId, session: ResolvedSession): List<Document> {
        val parts = mutableListOf(
            Criteria.where("portfolioId").`is`(portfolioId),
            userIdCriteria(session.userId),
        )
        tenantObjectId(session.tenantId)?.let { parts.add(Criteria.where("tenantId").`is`(it)) }
        val q = Query.query(Criteria().andOperator(*parts.toTypedArray()))
        q.with(Sort.by(Sort.Order.desc("isDefault"), Sort.Order.asc("createdAt")))
        return mongoTemplate.find(q, Document::class.java, props.accountsCollection)
    }

    fun updatePortfolioName(portfolio: Document, name: String): Document? {
        val id = portfolio.getObjectId("_id") ?: return null
        val trimmed = name.trim().take(200)
        if (trimmed.isEmpty()) {
            return portfolio
        }
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(id)),
            Update().set("name", trimmed).set("updatedAt", Date()),
            props.portfoliosCollection,
        )
        return mongoTemplate.findById(id, Document::class.java, props.portfoliosCollection)
    }

    fun buildSummaryPayload(portfolio: Document, session: ResolvedSession): Map<String, Any?> {
        val id = portfolio.getObjectId("_id") ?: throw IllegalStateException("portfolio id missing")
        val portfolioIdHex = id.toHexString()
        val accounts = listAccountsForPortfolio(id, session).map { acc ->
            mapOf(
                "_id" to acc.getObjectId("_id")?.toHexString(),
                "name" to (acc.getString("name")?.takeIf { it.isNotBlank() } ?: "Account"),
                "accountRef" to (acc.getString("extAccountId") ?: ""),
                "brokerType" to (acc.getString("type") ?: "fidelity"),
                "balance" to ((acc.get("cashBalance") as? Number)?.toDouble()
                    ?: props.defaultAccountCashBalance),
                "riskLevel" to "medium",
                "strategy" to "balanced",
                "positions" to emptyList<Any>(),
                "recommendations" to emptyList<Any>(),
            )
        }
        val userIdOut = portfolioUserIdString(portfolio) ?: session.userId
        val name = portfolio.getString("name")?.takeIf { it.isNotEmpty() } ?: "Default Portfolio"
        return mapOf(
            "_id" to portfolioIdHex,
            "name" to name,
            "accounts" to accounts,
            "totalValue" to 0,
            "dailyChange" to 0,
            "dailyChangePercent" to 0,
            "userId" to userIdOut,
            "isDefault" to readBooleanField(portfolio, "isDefault", false),
            "ext_broker_ref" to (portfolio.getString("ext_broker_ref") ?: props.defaultExtBrokerRef),
            "tenantPortfolioOrgKey" to (portfolio.getString("tenantPortfolioOrgKey") ?: props.tenantPortfolioOrgKey),
            "createdAt" to isoTimestamp(portfolio["createdAt"]),
            "updatedAt" to isoTimestamp(portfolio["updatedAt"]),
        )
    }

    private fun portfolioAccessCriteria(portfolioObjectId: ObjectId, session: ResolvedSession): Criteria {
        val parts = mutableListOf(
            Criteria.where("_id").`is`(portfolioObjectId),
            userIdCriteria(session.userId),
        )
        tenantObjectId(session.tenantId)?.let { parts.add(Criteria.where("tenantId").`is`(it)) }
        return Criteria().andOperator(*parts.toTypedArray())
    }

    private fun userIdCriteria(userId: String): Criteria =
        if (ObjectId.isValid(userId)) {
            Criteria.where("userId").`in`(listOf(userId, ObjectId(userId)))
        } else {
            Criteria.where("userId").`is`(userId)
        }

    private fun tenantObjectId(tenantId: String): ObjectId? =
        if (ObjectId.isValid(tenantId)) ObjectId(tenantId) else null

    private fun portfolioUserIdString(portfolio: Document): String? {
        val v = portfolio["userId"] ?: return null
        return when (v) {
            is String -> v.takeIf { it.isNotBlank() }
            is ObjectId -> v.toHexString()
            else -> null
        }
    }

    private fun readBooleanField(doc: Document, key: String, default: Boolean): Boolean {
        val v = doc[key] ?: return default
        return when (v) {
            is Boolean -> v
            else -> default
        }
    }

    private fun isoTimestamp(value: Any?): String =
        when (value) {
            is Date -> value.toInstant().toString()
            is Number -> Date(value.toLong()).toInstant().toString()
            is String -> runCatching { Instant.parse(value).toString() }.getOrElse { Instant.now().toString() }
            else -> Instant.now().toString()
        }
}
