package com.atxfinance.backend.admin

import com.atxfinance.backend.audit.AuditEventService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.util.Date

@Service
class AdminDeployNoteConfigService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val auditEventService: AuditEventService,
) {

    fun list(session: ResolvedSession, limit: Int, environment: String?): List<Map<String, Any?>> {
        val lim = limit.coerceIn(1, 200)
        val base = Criteria()
        val envLower = environment?.trim()?.lowercase()
        val crit = if (envLower in listOf("staging", "production")) {
            Criteria().andOperator(base, Criteria.where("environment").`is`(envLower))
        } else {
            base
        }
        val q = Query.query(PortfolioMongoFilter.withTenantScopeCriteria(crit, session.tenantId.takeIf { it.isNotBlank() }))
            .with(Sort.by(Sort.Direction.DESC, "updatedAt", "createdAt"))
            .limit(lim)
        return mongoTemplate.find(q, Document::class.java, props.deployNoteConfigsCollection)
            .map { serialize(it) }
    }

    fun create(session: ResolvedSession, body: Map<String, Any?>): Map<String, Any?> {
        val name = (body["name"] as? String)?.trim()
            ?: throw BadPayloadException("name is required")
        if (name.length !in 2..80) throw BadPayloadException("name must be 2-80 chars")
        val env = (body["environment"] as? String)?.trim()?.lowercase()
            ?: throw BadPayloadException("environment is required")
        if (env !in listOf("staging", "production")) throw BadPayloadException("environment must be staging or production")
        val enabled = body["enabled"] as? Boolean ?: true
        val includeRunUrl = body["includeRunUrl"] as? Boolean ?: true
        val includeActor = body["includeActor"] as? Boolean ?: true
        val defaultDeploymentNotes = optionalString(body["defaultDeploymentNotes"], 2000)
        val defaultHotfixNotes = optionalString(body["defaultHotfixNotes"], 2000)

        val now = Date()
        val doc = Document()
        doc["name"] = name
        doc["environment"] = env
        doc["enabled"] = enabled
        doc["includeRunUrl"] = includeRunUrl
        doc["includeActor"] = includeActor
        defaultDeploymentNotes?.let { doc["defaultDeploymentNotes"] = it }
        defaultHotfixNotes?.let { doc["defaultHotfixNotes"] = it }
        doc["createdAt"] = now
        doc["updatedAt"] = now
        PortfolioMongoFilter.tenantObjectId(session.tenantId)?.let { doc["tenantId"] = it }

        val inserted = mongoTemplate.insert(doc, props.deployNoteConfigsCollection)
        auditEventService.insertEvent(
            "deploy_note_config",
            (inserted["_id"] as? org.bson.types.ObjectId)?.toHexString() ?: "",
            "created",
            session,
            mapOf("environment" to env, "enabled" to enabled),
        )
        return mapOf("data" to serialize(inserted))
    }

    fun getById(configId: String, session: ResolvedSession): Map<String, Any?>? {
        if (!ObjectId.isValid(configId)) return null
        val oid = ObjectId(configId)
        val q = Query.query(PortfolioMongoFilter.withTenantScopeCriteria(Criteria.where("_id").`is`(oid), session.tenantId.takeIf { it.isNotBlank() }))
        val doc = mongoTemplate.findOne(q, Document::class.java, props.deployNoteConfigsCollection)
            ?: return null
        return serialize(doc)
    }

    fun update(configId: String, session: ResolvedSession, body: Map<String, Any?>): Map<String, Any?>? {
        if (!ObjectId.isValid(configId)) return null
        val oid = ObjectId(configId)
        val updates = mutableMapOf<String, Any?>()
        (body["name"] as? String)?.trim()?.let { if (it.length in 2..80) updates["name"] = it }
        (body["environment"] as? String)?.trim()?.lowercase()?.let { if (it in listOf("staging", "production")) updates["environment"] = it }
        (body["enabled"] as? Boolean)?.let { updates["enabled"] = it }
        (body["includeRunUrl"] as? Boolean)?.let { updates["includeRunUrl"] = it }
        (body["includeActor"] as? Boolean)?.let { updates["includeActor"] = it }
        if (body.containsKey("defaultDeploymentNotes")) updates["defaultDeploymentNotes"] = optionalString(body["defaultDeploymentNotes"], 2000)
        if (body.containsKey("defaultHotfixNotes")) updates["defaultHotfixNotes"] = optionalString(body["defaultHotfixNotes"], 2000)
        if (updates.isEmpty()) throw BadPayloadException("Provide at least one field to update")

        updates["updatedAt"] = Date()
        val u = Update()
        updates.forEach { (k, v) ->
            if (v == null) u.unset(k) else u.set(k, v)
        }
        val q = Query.query(PortfolioMongoFilter.withTenantScopeCriteria(Criteria.where("_id").`is`(oid), session.tenantId.takeIf { it.isNotBlank() }))
        mongoTemplate.updateFirst(q, u, props.deployNoteConfigsCollection)
        auditEventService.insertEvent("deploy_note_config", configId, "updated", session, mapOf("changedFields" to updates.keys.toList()))
        return getById(configId, session)
    }

    fun delete(configId: String, session: ResolvedSession): Boolean {
        if (!ObjectId.isValid(configId)) return false
        val oid = ObjectId(configId)
        val q = Query.query(PortfolioMongoFilter.withTenantScopeCriteria(Criteria.where("_id").`is`(oid), session.tenantId.takeIf { it.isNotBlank() }))
        val result = mongoTemplate.remove(q, props.deployNoteConfigsCollection)
        if (result.deletedCount == 1L) {
            auditEventService.insertEvent("deploy_note_config", configId, "deleted", session)
        }
        return result.deletedCount == 1L
    }

    private fun optionalString(v: Any?, maxLen: Int): String? {
        return when (v) {
            null -> null
            is String -> v.trim().takeIf { it.isNotEmpty() && it.length <= maxLen }
            else -> null
        }
    }

    private fun serialize(doc: Document): Map<String, Any?> {
        val m = mutableMapOf<String, Any?>(
            "_id" to (doc["_id"] as? org.bson.types.ObjectId)?.toHexString(),
            "name" to doc.getString("name"),
            "environment" to doc.getString("environment"),
            "enabled" to (doc["enabled"] as? Boolean ?: true),
            "includeRunUrl" to (doc["includeRunUrl"] as? Boolean ?: true),
            "includeActor" to (doc["includeActor"] as? Boolean ?: true),
            "defaultDeploymentNotes" to doc.getString("defaultDeploymentNotes"),
            "defaultHotfixNotes" to doc.getString("defaultHotfixNotes"),
            "createdAt" to ((doc["createdAt"] as? Date)?.toInstant()?.toString()),
            "updatedAt" to ((doc["updatedAt"] as? Date)?.toInstant()?.toString()),
        )
        return m
    }

    class BadPayloadException(message: String) : IllegalArgumentException(message)
}
