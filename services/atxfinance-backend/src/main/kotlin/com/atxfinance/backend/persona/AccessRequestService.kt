package com.atxfinance.backend.persona

import com.atxfinance.backend.audit.AuditEventService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.notify.SlackWebhookService
import com.atxfinance.backend.session.ResolvedSession
import com.fasterxml.jackson.databind.ObjectMapper
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.stereotype.Service
import java.util.Date

@Service
class AccessRequestService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val auditEventService: AuditEventService,
    private val slackWebhookService: SlackWebhookService,
    private val objectMapper: ObjectMapper,
) {
    private val actionableStatuses = listOf("new", "triaged", "pending")

    fun findPendingForUserAndRole(
        session: ResolvedSession,
        requestedRole: String,
    ): Document? {
        val parts = mutableListOf(
            Criteria.where("userId").`is`(session.userId),
            Criteria.where("requestedRole").`is`(requestedRole),
            Criteria.where("status").`in`(actionableStatuses),
        )
        tenantObjectId(session.tenantId)?.let { oid ->
            parts.add(Criteria.where("tenantId").`is`(oid))
        }
        val q = Query.query(Criteria().andOperator(*parts.toTypedArray()))
        return mongoTemplate.findOne(q, Document::class.java, props.accessRequestsCollection)
    }

    fun createSelfRequest(
        session: ResolvedSession,
        requestedRole: String,
        reason: String,
    ): Document {
        val now = Date()
        val doc = Document()
        doc["userId"] = session.userId
        doc["requestedRole"] = requestedRole
        doc["reason"] = reason
        doc["requestedPlan"] = "free"
        doc["status"] = "pending"
        doc["requestedAt"] = now
        tenantObjectId(session.tenantId)?.let { doc["tenantId"] = it }
        val contact = session.email?.takeIf { !isPlaceholderIdentityEmail(it) }
        if (contact != null) {
            doc["contactEmail"] = contact
        }
        mongoTemplate.insert(doc, props.accessRequestsCollection)
        val id = doc.getObjectId("_id")?.toHexString()
        if (id != null) {
            auditEventService.insertEvent(
                entityType = "access_request",
                entityId = id,
                action = "self_requested",
                session = session,
                details = mapOf(
                    "requestedRole" to requestedRole,
                    "reason" to reason,
                ),
            )
        }
        val who = session.username?.takeIf { it.isNotBlank() }?.let { "@$it (${session.email ?: ""})" }
            ?: (session.email ?: session.userId)
        val slackText = "🔔 New atxFinance access request from $who — role=$requestedRole"
        val slackPayload = mapOf("text" to slackText)
        slackWebhookService.postJson(objectMapper.writeValueAsString(slackPayload))
        return doc
    }

    private fun tenantObjectId(tenantId: String): ObjectId? =
        if (ObjectId.isValid(tenantId)) ObjectId(tenantId) else null

    private fun isPlaceholderIdentityEmail(email: String): Boolean {
        val n = email.lowercase()
        return n.endsWith("@x.oauth.local") || n.endsWith("@x.identity.local")
    }
}
