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
import java.util.regex.Pattern

@Service
class PortfolioCrudService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {

    private val brokerTypeRe = Pattern.compile("^[a-z][a-z0-9_]{0,31}$")

    fun countPortfoliosForSessionUser(session: ResolvedSession): Long {
        val crit =
            PortfolioMongoFilter.withTenantScopeCriteria(
                PortfolioMongoFilter.userIdCriteria(session.userId),
                session.tenantId,
            )
        return mongoTemplate.count(Query.query(crit), props.portfoliosCollection)
    }

    /**
     * App-user portfolio create (parity with Next `POST /api/portfolios`).
     * Returns null when limit reached or payload invalid.
     */
    fun createPortfolioForSessionUser(
        session: ResolvedSession,
        body: Map<String, Any?>,
    ): Document? {
        val nameRaw = body["name"] as? String ?: return null
        val trimmed = nameRaw.trim()
        if (trimmed.isEmpty() || trimmed.length > 200) {
            return null
        }
        val tenantOid = PortfolioMongoFilter.tenantObjectId(session.tenantId)
        if (tenantOid != null && countPortfoliosForSessionUser(session) >= MAX_PORTFOLIOS_PER_TENANT_USER) {
            return null
        }
        val isDefault = body["isDefault"] == true
        val now = Date()
        if (isDefault) {
            val base =
                Criteria.where("isDefault").`is`(true).andOperator(
                    PortfolioMongoFilter.userIdCriteria(session.userId),
                )
            val crit = PortfolioMongoFilter.strictWriteTenantCriteria(base, session.tenantId)
            mongoTemplate.updateMulti(
                Query.query(crit),
                Update().set("isDefault", false).set("updatedAt", now),
                props.portfoliosCollection,
            )
        }
        val doc = Document()
        doc["userId"] = session.userId
        doc["name"] = trimmed
        doc["isDefault"] = isDefault
        doc["tenantPortfolioOrgKey"] = props.tenantPortfolioOrgKey
        doc["createdAt"] = now
        doc["updatedAt"] = now
        doc["ext_broker_ref"] = props.defaultExtBrokerRef
        if (tenantOid != null) {
            doc["tenantId"] = tenantOid
        }
        parseBrokerType(body["broker_type"])?.let { doc["broker_type"] = it }
        parseOutlook(body["outlook"])?.let { doc["outlook"] = it }
        parsePortfolioKind(body["portfolioKind"])?.let { doc["portfolioKind"] = it }
        return try {
            mongoTemplate.insert(doc, props.portfoliosCollection)
            val id = doc.getObjectId("_id") ?: return null
            mongoTemplate.findById(id, Document::class.java, props.portfoliosCollection)
        } catch (_: Exception) {
            null
        }
    }

    sealed class DeleteSessionPortfolioResult {
        object Ok : DeleteSessionPortfolioResult()

        object NotFound : DeleteSessionPortfolioResult()

        object LastPortfolio : DeleteSessionPortfolioResult()
    }

    fun deletePortfolioForSessionUser(
        portfolioId: String,
        session: ResolvedSession,
    ): DeleteSessionPortfolioResult {
        val portfolio = findPortfolioForSessionUser(portfolioId, session) ?: return DeleteSessionPortfolioResult.NotFound
        if (countPortfoliosForSessionUser(session) <= 1L) {
            return DeleteSessionPortfolioResult.LastPortfolio
        }
        cascadeDeleteOwnedPortfolio(portfolio, session)
        return DeleteSessionPortfolioResult.Ok
    }

    private fun cascadeDeleteOwnedPortfolio(portfolio: Document, session: ResolvedSession) {
        val pid = portfolio.getObjectId("_id") ?: return
        val uidCrit = PortfolioMongoFilter.userIdCriteria(session.userId)
        val pf = Criteria.where("portfolioId").`is`(pid).andOperator(uidCrit)
        mongoTemplate.remove(Query.query(pf), props.positionsCollection)
        mongoTemplate.remove(Query.query(pf), props.portfolioRecommendationsCollection)
        mongoTemplate.remove(Query.query(pf), props.portfolioAlertsCollection)
        mongoTemplate.remove(Query.query(pf), props.portfolioDeliveryChannelsCollection)
        mongoTemplate.remove(Query.query(pf), props.accountsCollection)
        mongoTemplate.remove(Query.query(pf), props.watchlistsCollection)
        mongoTemplate.remove(Query.query(Criteria.where("_id").`is`(pid)), props.portfoliosCollection)
    }

    private fun parseOutlook(raw: Any?): String? {
        val s = (raw as? String)?.trim()?.lowercase() ?: return null
        return when (s) {
            "bullish", "up" -> "bullish"
            "neutral", "flat" -> "neutral"
            "bearish", "down" -> "bearish"
            else -> null
        }
    }

    private fun parsePortfolioKind(raw: Any?): String? {
        val s = (raw as? String)?.trim()?.lowercase() ?: return null
        return if (s == "real_estate" || s == "investments") s else null
    }

    private fun parseBrokerType(raw: Any?): String? {
        if (raw == null) {
            return null
        }
        val s = (raw as? String)?.trim()?.lowercase()?.take(32) ?: return null
        return if (brokerTypeRe.matcher(s).matches()) s else null
    }

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

    private companion object {
        private const val MAX_PORTFOLIOS_PER_TENANT_USER = 50
    }
}
