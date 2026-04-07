package com.atxfinance.backend.admin

import com.atxfinance.backend.audit.AuditEventService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.desk.DeskSmtpSender
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.session.ResolvedSession
import com.fasterxml.jackson.databind.ObjectMapper
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
import java.time.Instant
import java.util.Date

@Service
class AdminDeliveryChannelsService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val auditEventService: AuditEventService,
    private val objectMapper: ObjectMapper,
) {
    private val http: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build()

    private fun buildTestMessage(tenantId: String): String {
        val at = Instant.now().toString()
        return "hello from atx | tenant=$tenantId | at=$at"
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
        if (target !in listOf("in_app", "slack", "email")) {
            throw BadPayloadException("deliveryTarget must be in_app, slack, or email")
        }
        val slackUrl = (body["slackWebhookUrl"] as? String)?.trim()
        val emailTo = (body["emailTo"] as? String)?.trim()
        if (target == "slack") {
            if (slackUrl.isNullOrEmpty()) throw BadPayloadException("slackWebhookUrl is required when deliveryTarget is slack")
            if (!isSlackIncomingWebhookUrl(slackUrl)) throw BadPayloadException("Slack webhook must be https://hooks.slack.com/…")
        }
        if (target == "email") {
            if (emailTo.isNullOrEmpty()) throw BadPayloadException("emailTo is required when deliveryTarget is email")
            if (!isPlausibleEmail(emailTo)) throw BadPayloadException("emailTo must be a valid email address")
        }

        val now = Date()
        val doc = Document()
        doc["name"] = name
        doc["deliveryTarget"] = target
        if (target == "slack") doc["slackWebhookUrl"] = slackUrl
        if (target == "email") doc["emailTo"] = emailTo
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
        val hasEmail = body.containsKey("emailTo")
        if (!hasName && !hasTarget && !hasSlack && !hasEmail) {
            throw BadPayloadException("Provide at least one field to update")
        }

        val mergedName = if (hasName) (body["name"] as? String)?.trim() ?: "" else existing.getString("name") ?: ""
        val mergedTarget = if (hasTarget) {
            (body["deliveryTarget"] as? String)?.trim()?.lowercase()
        } else {
            existing.getString("deliveryTarget")
        }
        if (mergedTarget !in listOf("in_app", "slack", "email")) throw BadPayloadException("invalid deliveryTarget")
        val mergedSlack: String? =
            if (mergedTarget != "slack") {
                null
            } else if (hasSlack) {
                (body["slackWebhookUrl"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
            } else {
                existing.getString("slackWebhookUrl")?.trim()
            }
        val mergedEmail: String? =
            if (mergedTarget != "email") {
                null
            } else if (hasEmail) {
                (body["emailTo"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
            } else {
                existing.getString("emailTo")?.trim()
            }

        if (mergedName.isBlank() || mergedName.length > 120) throw BadPayloadException("name must be 1-120 chars")
        if (mergedTarget == "slack") {
            if (mergedSlack.isNullOrEmpty()) throw BadPayloadException("slackWebhookUrl is required when deliveryTarget is slack")
            if (!isSlackIncomingWebhookUrl(mergedSlack)) throw BadPayloadException("Slack webhook must be https://hooks.slack.com/…")
        }
        if (mergedTarget == "email") {
            if (mergedEmail.isNullOrEmpty()) throw BadPayloadException("emailTo is required when deliveryTarget is email")
            if (!isPlausibleEmail(mergedEmail)) throw BadPayloadException("emailTo must be a valid email address")
        }

        val u = Update().set("updatedAt", Date())
        if (hasName) u.set("name", mergedName)
        if (hasTarget) {
            u.set("deliveryTarget", mergedTarget)
            when (mergedTarget) {
                "in_app" -> {
                    u.unset("slackWebhookUrl")
                    u.unset("emailTo")
                }
                "slack" -> u.unset("emailTo")
                "email" -> u.unset("slackWebhookUrl")
            }
        }
        if (mergedTarget == "slack" && mergedSlack != null) {
            u.set("slackWebhookUrl", mergedSlack)
        }
        if (mergedTarget == "email" && mergedEmail != null) {
            u.set("emailTo", mergedEmail)
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
        val message = buildTestMessage(session.tenantId)
        if (target == "in_app") {
            return TestResult.Ok(
                mapOf(
                    "ok" to true,
                    "deliveryTarget" to "in_app",
                    "message" to message,
                    "inAppPreview" to true,
                    "detail" to
                        "In-app preview: use the on-screen sample notification (and optional browser notification if allowed). No external send.",
                ),
            )
        }
        if (target == "email") {
            val envOverride = System.getenv("DESK_DELIVERY_CHANNEL_TEST_TO")?.trim()?.takeIf { it.isNotEmpty() }
            val channelTo = doc.getString("emailTo")?.trim()?.takeIf { it.isNotEmpty() }
            val (to, usedEnvRecipientOverride) =
                when {
                    !envOverride.isNullOrEmpty() -> {
                        if (!isPlausibleEmail(envOverride)) {
                            return TestResult.BadRequest(
                                "DESK_DELIVERY_CHANNEL_TEST_TO is set but is not a valid email address",
                            )
                        }
                        Pair(envOverride, true)
                    }
                    !channelTo.isNullOrEmpty() -> {
                        if (!isPlausibleEmail(channelTo)) {
                            return TestResult.BadRequest("emailTo must be a valid email address")
                        }
                        Pair(channelTo, false)
                    }
                    else -> {
                        return TestResult.BadRequest(
                            "Email channel is missing emailTo — add a recipient or set DESK_DELIVERY_CHANNEL_TEST_TO",
                        )
                    }
                }
            val subjectRaw =
                System.getenv("DESK_DELIVERY_CHANNEL_TEST_SUBJECT")?.trim()?.takeIf { it.isNotEmpty() }
                    ?: "aTx Finance — delivery channel test"
            val subject = if (subjectRaw.length > 200) subjectRaw.take(200) else subjectRaw
            val ok = DeskSmtpSender.sendPlain(to, subject, message)
            if (!ok) {
                return TestResult.EmailSendFailed(
                    "SMTP send failed — check SMTP_* / DESK_EMAIL_FROM env on the backend service",
                )
            }
            val detail =
                if (usedEnvRecipientOverride) {
                    "SMTP test sent to $to (DESK_DELIVERY_CHANNEL_TEST_TO override; scheduled sends still use the channel recipient). Check that inbox (and spam)."
                } else {
                    "SMTP test sent to $to. Check that inbox (and spam)."
                }
            return TestResult.Ok(
                mapOf(
                    "ok" to true,
                    "deliveryTarget" to "email",
                    "message" to message,
                    "detail" to detail,
                    "usedEnvRecipientOverride" to usedEnvRecipientOverride,
                ),
            )
        }
        val url = doc.getString("slackWebhookUrl")?.trim()
        if (url.isNullOrEmpty()) return TestResult.BadRequest("Slack channel is missing slackWebhookUrl")
        val slackJson = objectMapper.writeValueAsString(mapOf("text" to message))
        val ok = postSlackIncomingWebhook(url, slackJson)
        if (!ok) return TestResult.UpstreamError
        return TestResult.Ok(
            mapOf(
                "ok" to true,
                "deliveryTarget" to "slack",
                "message" to message,
                "detail" to "Test message posted to the configured Slack incoming webhook.",
            ),
        )
    }

    sealed class TestResult {
        data class Ok(val body: Map<String, Any?>) : TestResult()
        object NotFound : TestResult()
        data class BadRequest(val message: String) : TestResult()
        object UpstreamError : TestResult()
        data class EmailSendFailed(val message: String) : TestResult()
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
            "emailTo" to (doc.getString("emailTo") ?: ""),
            "createdAt" to ((doc["createdAt"] as? Date)?.toInstant()?.toString()),
            "updatedAt" to ((doc["updatedAt"] as? Date)?.toInstant()?.toString()),
        )
    }

    private fun isPlausibleEmail(raw: String): Boolean {
        val s = raw.trim()
        if (s.length > 254) return false
        val at = s.indexOf('@')
        if (at <= 0 || at == s.length - 1) return false
        val local = s.substring(0, at)
        val domain = s.substring(at + 1)
        if (local.isEmpty() || domain.isEmpty() || !domain.contains('.')) return false
        return Regex("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$").matches(s)
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
