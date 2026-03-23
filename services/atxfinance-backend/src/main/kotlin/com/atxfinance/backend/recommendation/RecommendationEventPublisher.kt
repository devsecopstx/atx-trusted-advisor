package com.atxfinance.backend.recommendation

import com.fasterxml.jackson.databind.ObjectMapper
import com.google.cloud.pubsub.v1.Publisher
import com.google.protobuf.ByteString
import com.google.pubsub.v1.ProjectTopicName
import com.google.pubsub.v1.PubsubMessage
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.slf4j.LoggerFactory
import org.springframework.core.env.Environment
import org.springframework.stereotype.Component
import java.util.UUID

/**
 * Publishes when `RECOMMENDATIONS_PUBSUB_TOPIC` and a GCP project id are set (parity with Next `publishRecommendationEvent`).
 */
@Component
class RecommendationEventPublisher(
    private val env: Environment,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val lock = Any()
    private var publisher: Publisher? = null

    fun publishCreated(session: ResolvedSession, doc: Document) {
        val topicId = env.getProperty("RECOMMENDATIONS_PUBSUB_TOPIC")?.trim()?.takeIf { it.isNotEmpty() } ?: return
        val projectId =
            listOf("GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT", "GCP_PROJECT").firstNotNullOfOrNull { key ->
                env.getProperty(key)?.trim()?.takeIf { it.isNotEmpty() }
            } ?: return
        val id = doc.getObjectId("_id")?.toHexString() ?: return
        val scopeTags =
            when (val raw = doc["scopeTags"]) {
                is List<*> -> raw.mapNotNull { it?.toString() }
                else -> emptyList()
            }
        val occurredAt =
            doc.getDate("createdAt")?.toInstant()?.toString() ?: ""
        val payload =
            mapOf(
                "event" to "created",
                "recommendationId" to id,
                "userId" to session.userId,
                "tenantId" to session.tenantId,
                "status" to (doc.getString("status") ?: "active"),
                "occurredAt" to occurredAt,
                "scopeTags" to scopeTags,
                "correlationId" to UUID.randomUUID().toString(),
            )
        val json = objectMapper.writeValueAsString(payload)
        try {
            val pub = publisher(topicId, projectId)
            val message =
                PubsubMessage.newBuilder()
                    .setData(ByteString.copyFromUtf8(json))
                    .putAttributes("event", "created")
                    .putAttributes("userId", session.userId)
                    .putAttributes("tenantId", session.tenantId)
                    .build()
            pub.publish(message).get()
        } catch (e: Exception) {
            log.warn("[recommendations-pubsub] publish failed: {}", e.message)
        }
    }

    private fun publisher(topicId: String, projectId: String): Publisher {
        synchronized(lock) {
            val existing = publisher
            if (existing != null) {
                return existing
            }
            val created = Publisher.newBuilder(ProjectTopicName.of(projectId, topicId)).build()
            publisher = created
            return created
        }
    }
}
