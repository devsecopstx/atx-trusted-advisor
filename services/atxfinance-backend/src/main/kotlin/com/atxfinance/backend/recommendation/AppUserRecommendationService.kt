package com.atxfinance.backend.recommendation

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.BsonJson
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
class AppUserRecommendationService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {

    private val allowedStatus = setOf("draft", "active", "dismissed", "superseded")

    fun list(session: ResolvedSession, limit: Int): List<Map<String, Any?>> {
        val lim = limit.coerceIn(1, 100)
        val base = MongoQuerySupport.userIdCriteria(session.userId)
        val crit = MongoQuerySupport.andWithTenantReadScope(base, session.tenantId)
        val q = Query.query(crit).with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(lim)
        return mongoTemplate.find(q, Document::class.java, props.appUserRecommendationsCollection)
            .map { BsonJson.documentToMap(it) }
    }

    fun getById(session: ResolvedSession, id: String): Document? {
        if (!ObjectId.isValid(id)) {
            return null
        }
        val base = Criteria().andOperator(
            Criteria.where("_id").`is`(ObjectId(id)),
            MongoQuerySupport.userIdCriteria(session.userId),
        )
        val crit = MongoQuerySupport.andWithTenantReadScope(base, session.tenantId)
        return mongoTemplate.findOne(Query.query(crit), Document::class.java, props.appUserRecommendationsCollection)
    }

    fun create(session: ResolvedSession, body: Map<String, Any?>): Document {
        val title = (body["title"] as? String)?.trim()
            ?: throw IllegalArgumentException("title required")
        if (title.isEmpty() || title.length > 500) {
            throw IllegalArgumentException("title length")
        }
        val summary = (body["summary"] as? String)?.trim()?.take(4000)
        val scopeTags = (body["scopeTags"] as? List<*>)
            ?.mapNotNull { it?.toString()?.trim()?.take(128) }
            ?.filter { it.isNotEmpty() }
            ?.take(32)
            ?: emptyList()
        @Suppress("UNCHECKED_CAST")
        val payload = (body["payload"] as? Map<String, Any?>) ?: emptyMap()
        val statusRaw = (body["status"] as? String)?.trim()?.lowercase()
        val status = if (statusRaw != null && statusRaw in allowedStatus) statusRaw else "active"
        val now = Date()
        val doc = Document()
        doc["userId"] = session.userId
        MongoQuerySupport.tenantObjectId(session.tenantId)?.let { doc["tenantId"] = it }
        doc["title"] = title
        summary?.let { doc["summary"] = it }
        doc["scopeTags"] = scopeTags
        doc["payload"] = Document(payload)
        doc["status"] = status
        doc["source"] = "user"
        doc["createdAt"] = now
        doc["updatedAt"] = now
        mongoTemplate.insert(doc, props.appUserRecommendationsCollection)
        return doc
    }
}
