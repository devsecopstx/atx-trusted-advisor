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
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.util.Date

@Service
class AdminDeliveryChannelsService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val auditEventService: AuditEventService,
) {
    private val http: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build()

    companion object {
        private const val TEST_TEXT = "hello from atx"
    }

    fun list(session: ResolvedSession): List<Map<String, Any?>> {
        val q = Query.query(
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria(),
                session.tenantId.takeIf { it.isNotBlank() },
            ),
        ).with(Sort.by(Sort.Direction.DESC, "updatedAt", "createdAt"))
        return mongoTemplate.find(q, Document::class.java, props.adminDeliveryChannelsCollection)
            .map { serialize(it) }
    }

    fun create(session: ResolvedSession, body: Map<String, Any?>): Map<String, Any?> {
        val name = (body["name"] as? String)?.trim() ?: throw BadPayloadException("name is required")
        if (name.isEmpty() || name.length > 120) throw BadPayloadException("name must be 1-120 chars")
        val target = (body["deliveryTarget"] as? String)?.trim()?.lowercase()
            ?: throw BadPayloadException("deliveryTarget is required")
        if (target !in listOf("in_app", "slack")) throw BadPayloadException("deliveryTarget must be in_app or slack")
        val slackUrl = (body["slackWebhookUrl"] as? String)?.trim()
        if (target == "slack") {
            if (slackUrl.isNullOrEmpty()) throw BadPayloadException("slackWebhookUrl is required when deliveryTarget is slack")
            if (!isSlackIncomingWebhookUrl(slackUrl)) throw BadPayloadException("Slack webhook must be https://hooks.slack.com/…")
        }

        val now = Date()
        val doc = Document()
        doc["name"] = name
        doc["deliveryTarget"] = target
        if (target == "slack") doc["slackWebhookUrl"] = slackUrl
        doc["createdAt"] = now
        doc["updatedAt"] = now
        PortfolioMongoFilter.tenantObjectId(session.tenantId)?.let { doc["tenantId"] = it }

        val inserted = mongoTemplate.insert(doc, props.adminDeliveryChannelsCollection)
        val id = (inserted["_id"] as ObjectId).toHexString()
        auditEventService.insertEvent(
            "admin_delivery_channel",
            id,
            "created",
            session,
            mapOf("name" to name, "deliveryTarget" to target),
        )
        return mapOf("data" to serialize(inserted))
    }

    fun getById(channelId: String, session: ResolvedSession): Map<String, Any?>? {
        return findDoc(channelId, session)?.let { serialize(it) }
    }

    fun update(channelId: String, session: ResolvedSession, body: Map<String, Any?>): Map<String, Any?>? {
        val existing = findDoc(channelId, session) ?: return null
        val hasName = body.containsKey("name")
        val hasTarget = body.containsKey("deliveryTarget")
        val hasSlack = body.containsKey("slackWebhookUrl")
        if (!hasName && !hasTarget && !hasSlack) throw BadPayloadException("Provide at least one field to update")

        val mergedName = if (hasName) (body["name"] as? String)?.trim() ?: "" else existing.getString("name") ?: ""
        val mergedTarget = if (hasTarget) {
            (body["deliveryTarget"] as? String)?.trim()?.lowercase()
        } else {
            existing.getString("deliveryTarget")
        }
        if (mergedTarget !in listOf("in_app", "slack")) throw BadPayloadException("invalid deliveryTarget")
        val mergedSlack: String? = when {
            mergedTarget == "in_app" -> null
            hasSlack -> (body["slackWebhookUrl"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
            else -> existing.getString("slackWebhookUrl")?.trim()
        }

        if (mergedName.isBlank() || mergedName.length > 120) throw BadPayloadException("name must be 1-120 chars")
        if (mergedTarget == "slack") {
            if (mergedSlack.isNullOrEmpty()) throw BadPayloadException("slackWebhookUrl is required when deliveryTarget is slack")
            if (!isSlackIncomingWebhookUrl(mergedSlack)) throw BadPayloadException("Slack webhook must be https://hooks.slack.com/…")
        }

        val u = Update().set("updatedAt", Date())
        if (hasName) u.set("name", mergedName)
        if (hasTarget) {
            u.set("deliveryTarget", mergedTarget)
            if (mergedTarget == "in_app") u.unset("slackWebhookUrl")
        }
        if (mergedTarget == "slack" && hasSlack) {
            u.set("slackWebhookUrl", mergedSlack)
        }

        val oid = ObjectId(channelId)
        val q = Query.query(
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria.where("_id").`is`(oid),
                session.tenantId.takeIf { it.isNotBlank() },
            ),
        )
        mongoTemplate.updateFirst(q, u, props.adminDeliveryChannelsCollection)

        auditEventService.insertEvent(
            "admin_delivery_channel",
            channelId,
            "updated",
            session,
            mapOf("changedFields" to body.keys.toList()),
        )
        return getById(channelId, session)
    }

    fun delete(channelId: String, session: ResolvedSession): Boolean {
        val existing = findDoc(channelId, session) ?: return false
        val oid = ObjectId(channelId)
        val q = Query.query(
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria.where("_id").`is`(oid),
                session.tenantId.takeIf { it.isNotBlank() },
            ),
        )
        val result = mongoTemplate.remove(q, props.adminDeliveryChannelsCollection)
        if (result.deletedCount == 1L) {
            auditEventService.insertEvent(
                "admin_delivery_channel",
                channelId,
                "deleted",
                session,
                mapOf("name" to existing.getString("name")),
            )
        }
        return result.deletedCount == 1L
    }

    fun test(channelId: String, session: ResolvedSession): TestResult {
        val doc = findDoc(channelId, session) ?: return TestResult.NotFound
        val target = doc.getString("deliveryTarget") ?: return TestResult.BadRequest("invalid channel")
        if (target == "in_app") {
            return TestResult.Ok(
                mapOf(
                    "ok" to true,
                    "deliveryTarget" to "in_app",
                    "message" to TEST_TEXT,
                    "detail" to "In-app delivery has no external test send; channel is saved for future routing.",
                ),
            )
        }
        val url = doc.getString("slackWebhookUrl")?.trim()
        if (url.isNullOrEmpty()) return TestResult.BadRequest("Slack channel is missing slackWebhookUrl")
        val ok = postSlackIncomingWebhook(url, """{"text":"$TEST_TEXT"}""")
        if (!ok) return TestResult.UpstreamError
        return TestResult.Ok(mapOf("ok" to true, "deliveryTarget" to "slack", "message" to TEST_TEXT))
    }

    sealed class TestResult {
        data class Ok(val body: Map<String, Any?>) : TestResult()
        object NotFound : TestResult()
        data class BadRequest(val message: String) : TestResult()
        object UpstreamError : TestResult()
    }

    private fun findDoc(channelId: String, session: ResolvedSession): Document? {
        if (!ObjectId.isValid(channelId)) return null
        val oid = ObjectId(channelId)
        val q = Query.query(
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria.where("_id").`is`(oid),
                session.tenantId.takeIf { it.isNotBlank() },
            ),
        )
        return mongoTemplate.findOne(q, Document::class.java, props.adminDeliveryChannelsCollection)
    }

    private fun serialize(doc: Document): Map<String, Any?> {
        return mapOf(
            "_id" to (doc["_id"] as? ObjectId)?.toHexString(),
            "name" to doc.getString("name"),
            "deliveryTarget" to doc.getString("deliveryTarget"),
            "slackWebhookUrl" to (doc.getString("slackWebhookUrl") ?: ""),
            "createdAt" to ((doc["createdAt"] as? Date)?.toInstant()?.toString()),
            "updatedAt" to ((doc["updatedAt"] as? Date)?.toInstant()?.toString()),
        )
    }

    private fun isSlackIncomingWebhookUrl(raw: String): Boolean {
        return try {
            val u = URI.create(raw.trim())
            u.scheme == "https" && u.host == "hooks.slack.com"
        } catch (_: Exception) {
            false
        }
    }

    private fun postSlackIncomingWebhook(webhookUrl: String, jsonBody: String): Boolean {
        if (!isSlackIncomingWebhookUrl(webhookUrl)) return false
        val req = HttpRequest.newBuilder(URI.create(webhookUrl.trim()))
            .timeout(Duration.ofSeconds(10))
            .header("Content-Type", "application/json; charset=utf-8")
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
            .build()
        return try {
            val res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
            res.statusCode() in 200..299
        } catch (_: Exception) {
            false
        }
    }

    class BadPayloadException(message: String) : IllegalArgumentException(message)
}
