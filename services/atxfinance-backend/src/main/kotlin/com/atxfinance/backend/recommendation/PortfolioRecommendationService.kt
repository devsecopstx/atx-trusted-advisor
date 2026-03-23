package com.atxfinance.backend.recommendation

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.BsonJson
import com.atxfinance.backend.portfolio.PortfolioCrudService
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.stereotype.Service
import java.util.Date

@Service
class PortfolioRecommendationService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val portfolioCrudService: PortfolioCrudService,
) {

    /** `null` if portfolio not found or not accessible for session. */
    fun list(session: ResolvedSession, portfolioId: String): List<Map<String, Any?>>? {
        val portfolio = portfolioCrudService.findPortfolioForSessionUser(portfolioId, session) ?: return null
        val pid = portfolio.getObjectId("_id") ?: return null
        val base = Criteria().andOperator(
            MongoQuerySupport.userIdCriteria(session.userId),
            Criteria.where("portfolioId").`is`(pid),
        )
        val crit = MongoQuerySupport.andWithTenantReadScope(base, session.tenantId)
        val q = Query.query(crit).with(Sort.by(Sort.Direction.DESC, "createdAt"))
        return mongoTemplate.find(q, Document::class.java, props.portfolioRecommendationsCollection)
            .map { serializePortfolioRow(it) }
    }

    fun create(
        session: ResolvedSession,
        portfolioId: String,
        body: Map<String, Any?>,
    ): Document? {
        val portfolio = portfolioCrudService.findPortfolioForSessionUser(portfolioId, session) ?: return null
        val pid = portfolio.getObjectId("_id") ?: return null
        val symbol = (body["symbol"] as? String)?.trim()?.uppercase()
            ?: throw IllegalArgumentException("symbol")
        if (symbol.isEmpty() || symbol.length > 32) {
            throw IllegalArgumentException("symbol length")
        }
        val action = (body["action"] as? String)?.trim()?.lowercase()
            ?: throw IllegalArgumentException("action")
        if (action !in setOf("buy", "sell", "hold", "watch")) {
            throw IllegalArgumentException("action")
        }
        val note = (body["note"] as? String)?.trim()?.take(2000)
        val accountIdRaw = body["accountId"] as? String
        val accountId = accountIdRaw?.trim()?.takeIf { it.isNotEmpty() && ObjectId.isValid(it) }?.let { ObjectId(it) }
        val quantity = (body["quantity"] as? Number)?.toDouble()?.takeIf { it.isFinite() && it > 0 }
        val targetPrice = (body["targetPrice"] as? Number)?.toDouble()?.takeIf { it.isFinite() && it > 0 }
        val now = Date()
        val doc = Document()
        MongoQuerySupport.tenantObjectId(session.tenantId)?.let { doc["tenantId"] = it }
        doc["userId"] = session.userId
        doc["portfolioId"] = pid
        accountId?.let { doc["accountId"] = it }
        doc["symbol"] = symbol
        doc["action"] = action
        note?.let { doc["note"] = it }
        quantity?.let { doc["quantity"] = it }
        targetPrice?.let { doc["targetPrice"] = it }
        doc["status"] = "new"
        doc["createdAt"] = now
        doc["updatedAt"] = now
        mongoTemplate.insert(doc, props.portfolioRecommendationsCollection)
        return doc
    }

    fun rowMap(doc: Document): Map<String, Any?> = serializePortfolioRow(doc)

    private fun serializePortfolioRow(doc: Document): Map<String, Any?> {
        val m = LinkedHashMap<String, Any?>()
        m["_id"] = doc.getObjectId("_id")?.toHexString()
        m["symbol"] = doc.getString("symbol")
        m["action"] = doc.getString("action")
        m["note"] = doc.getString("note")
        m["quantity"] = (doc["quantity"] as? Number)?.toDouble()
        m["targetPrice"] = (doc["targetPrice"] as? Number)?.toDouble()
        m["status"] = doc.getString("status")
        m["accountId"] = doc.getObjectId("accountId")?.toHexString()
        m["portfolioId"] = doc.getObjectId("portfolioId")?.toHexString()
        m["createdAt"] = BsonJson.value(doc["createdAt"]).toString()
        m["updatedAt"] = BsonJson.value(doc["updatedAt"]).toString()
        return m
    }
}
