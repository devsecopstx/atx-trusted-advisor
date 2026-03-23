package com.atxfinance.backend.audit

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.BsonJson
import org.bson.Document
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.Date

@Service
class AdminAuditQueryService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {

    fun list(
        entityType: String?,
        entityId: String?,
        action: String?,
        actor: String?,
        from: Instant?,
        to: Instant?,
        limit: Int,
    ): List<Map<String, Any?>> {
        val parts = mutableListOf<Criteria>()
        entityType?.takeIf { it.isNotBlank() }?.let { parts.add(Criteria.where("entityType").`is`(it)) }
        entityId?.takeIf { it.isNotBlank() }?.let { parts.add(Criteria.where("entityId").`is`(it)) }
        action?.takeIf { it.isNotBlank() }?.let { parts.add(Criteria.where("action").`is`(it)) }
        actor?.takeIf { it.isNotBlank() }?.let {
            parts.add(
                Criteria().orOperator(
                    Criteria.where("actor.userId").`is`(it),
                    Criteria.where("actor.email").`is`(it),
                    Criteria.where("actor.username").`is`(it),
                ),
            )
        }
        from?.let { parts.add(Criteria.where("createdAt").gte(Date.from(it))) }
        to?.let { parts.add(Criteria.where("createdAt").lte(Date.from(it))) }
        val crit = if (parts.isEmpty()) {
            Criteria()
        } else {
            Criteria().andOperator(*parts.toTypedArray())
        }
        val q = Query.query(crit).with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(limit.coerceIn(1, 500))
        return mongoTemplate.find(q, Document::class.java, props.auditEventsCollection).map { serialize(it) }
    }

    private fun serialize(doc: Document): Map<String, Any?> {
        val actorDoc = doc["actor"] as? Document
        val actor = actorDoc?.let { BsonJson.documentToMap(it) }
        return mapOf(
            "_id" to doc.getObjectId("_id")?.toHexString(),
            "entityType" to doc.getString("entityType"),
            "entityId" to doc.getString("entityId"),
            "action" to doc.getString("action"),
            "actor" to actor,
            "details" to (doc.get("details")?.let { BsonJson.value(it) }),
            "createdAt" to BsonJson.value(doc["createdAt"]).toString(),
        )
    }
}
