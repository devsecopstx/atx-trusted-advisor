package com.atxfinance.backend.audit

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.stereotype.Service
import java.util.Date

@Service
class AuditEventService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    fun insertEvent(
        entityType: String,
        entityId: String,
        action: String,
        session: ResolvedSession,
        details: Map<String, Any?> = emptyMap(),
    ) {
        val actor = Document()
        actor["userId"] = session.userId
        session.email?.let { actor["email"] = it }
        session.username?.let { actor["username"] = it }
        val doc = Document()
        doc["entityType"] = entityType
        doc["entityId"] = entityId
        doc["action"] = action
        doc["actor"] = actor
        if (details.isNotEmpty()) {
            doc["details"] = Document(details)
        }
        doc["createdAt"] = Date()
        mongoTemplate.insert(doc, props.auditEventsCollection)
    }
}
