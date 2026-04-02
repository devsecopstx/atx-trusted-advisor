package com.atxfinance.backend.admin

import com.atxfinance.backend.audit.AuditEventService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import com.atxfinance.backend.portfolio.BsonJson
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.util.Date

/** Global-admin `portfolio_delivery_channels` — parity with Next admin routes. */
@Service
class AdminPortfolioDeliveryChannelsService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val adminPortfolioAccountsService: AdminPortfolioAccountsService,
    private val auditEventService: AuditEventService,
) {
    private val kinds = setOf("email", "slack_webhook", "sms", "push")

    fun list(portfolioId: String): List<Map<String, Any?>>? {
        val scope = adminPortfolioAccountsService.resolvePortfolioOwnerScope(portfolioId) ?: return null
        val pid = scope.portfolio.getObjectId("_id") ?: return null
        val base =
            Criteria().andOperator(
                PortfolioMongoFilter.userIdCriteria(scope.ownerUserId),
                Criteria.where("portfolioId").`is`(pid),
            )
        val crit = PortfolioMongoFilter.withTenantScopeCriteria(base, scope.tenantIdHex)
        val q = Query.query(crit).with(Sort.by(Sort.Direction.ASC, "label")).limit(100)
        return mongoTemplate.find(q, Document::class.java, props.portfolioDeliveryChannelsCollection)
            .map { toJson(it) }
    }

    fun create(session: ResolvedSession, portfolioId: String, body: Map<String, Any?>): Document? {
        val scope = adminPortfolioAccountsService.resolvePortfolioOwnerScope(portfolioId) ?: return null
        val pid = scope.portfolio.getObjectId("_id") ?: return null
        val kind =
            (body["kind"] as? String)?.trim()?.lowercase()?.takeIf { it in kinds } ?: return null
        val label =
            (body["label"] as? String)?.trim()?.take(128)?.takeIf { it.isNotEmpty() } ?: return null
        val destination =
            (body["destination"] as? String)?.trim()?.take(2048)?.takeIf { it.isNotEmpty() } ?: return null
        val enabled = body["enabled"] as? Boolean ?: true
        val now = Date()
        val doc = Document()
        PortfolioMongoFilter.tenantObjectId(scope.tenantIdHex ?: "")?.let { doc["tenantId"] = it }
        doc["userId"] = scope.ownerUserId
        doc["portfolioId"] = pid
        doc["kind"] = kind
        doc["label"] = label
        doc["destination"] = destination
        doc["enabled"] = enabled
        doc["createdAt"] = now
        doc["updatedAt"] = now
        mongoTemplate.insert(doc, props.portfolioDeliveryChannelsCollection)
        val id = doc.getObjectId("_id") ?: return null
        val saved = mongoTemplate.findById(id, Document::class.java, props.portfolioDeliveryChannelsCollection) ?: return null
        auditEventService.insertEvent(
            AdminPortfolioAudit.ENTITY_TYPE,
            portfolioId,
            "delivery_channel_created",
            session,
            mapOf(
                "channelId" to id.toHexString(),
                "kind" to kind,
                "label" to label,
                "destinationChars" to destination.length,
            ),
        )
        return saved
    }

    fun patch(session: ResolvedSession, portfolioId: String, channelId: String, body: Map<String, Any?>): Document? {
        if (!ObjectId.isValid(channelId)) {
            return null
        }
        val scope = adminPortfolioAccountsService.resolvePortfolioOwnerScope(portfolioId) ?: return null
        val pid = scope.portfolio.getObjectId("_id") ?: return null
        val cid = ObjectId(channelId)
        val filter =
            PortfolioMongoFilter.strictWriteTenantCriteria(
                Criteria().andOperator(
                    Criteria.where("_id").`is`(cid),
                    PortfolioMongoFilter.userIdCriteria(scope.ownerUserId),
                    Criteria.where("portfolioId").`is`(pid),
                ),
                scope.tenantIdHex,
            )
        val existing =
            mongoTemplate.findOne(Query.query(filter), Document::class.java, props.portfolioDeliveryChannelsCollection)
                ?: return null
        val now = Date()
        val update = Update()
        var any = false
        if (body.containsKey("kind")) {
            val k = (body["kind"] as? String)?.trim()?.lowercase()
            if (k in kinds) {
                update.set("kind", k)
                any = true
            }
        }
        if (body.containsKey("label")) {
            val l = (body["label"] as? String)?.trim()?.take(128)?.takeIf { it.isNotEmpty() }
            if (l != null) {
                update.set("label", l)
                any = true
            }
        }
        if (body.containsKey("destination")) {
            val d = (body["destination"] as? String)?.trim()?.take(2048)?.takeIf { it.isNotEmpty() }
            if (d != null) {
                update.set("destination", d)
                any = true
            }
        }
        if (body.containsKey("enabled")) {
            val e = body["enabled"] as? Boolean
            if (e != null) {
                update.set("enabled", e)
                any = true
            }
        }
        if (!any) {
            return existing
        }
        update.set("updatedAt", now)
        mongoTemplate.updateFirst(Query.query(filter), update, props.portfolioDeliveryChannelsCollection)
        val out =
            mongoTemplate.findOne(Query.query(filter), Document::class.java, props.portfolioDeliveryChannelsCollection)
        auditEventService.insertEvent(
            AdminPortfolioAudit.ENTITY_TYPE,
            portfolioId,
            "delivery_channel_updated",
            session,
            mapOf("channelId" to channelId),
        )
        return out
    }

    fun delete(session: ResolvedSession, portfolioId: String, channelId: String): Boolean {
        if (!ObjectId.isValid(channelId)) {
            return false
        }
        val scope = adminPortfolioAccountsService.resolvePortfolioOwnerScope(portfolioId) ?: return false
        val pid = scope.portfolio.getObjectId("_id") ?: return false
        val filter =
            PortfolioMongoFilter.strictWriteTenantCriteria(
                Criteria().andOperator(
                    Criteria.where("_id").`is`(ObjectId(channelId)),
                    PortfolioMongoFilter.userIdCriteria(scope.ownerUserId),
                    Criteria.where("portfolioId").`is`(pid),
                ),
                scope.tenantIdHex,
            )
        val res = mongoTemplate.remove(Query.query(filter), props.portfolioDeliveryChannelsCollection)
        val ok = res.deletedCount == 1L
        if (ok) {
            auditEventService.insertEvent(
                AdminPortfolioAudit.ENTITY_TYPE,
                portfolioId,
                "delivery_channel_deleted",
                session,
                mapOf("channelId" to channelId),
            )
        }
        return ok
    }

    fun toJson(doc: Document): Map<String, Any?> =
        mapOf(
            "_id" to doc.getObjectId("_id")?.toHexString(),
            "kind" to doc.getString("kind"),
            "label" to doc.getString("label"),
            "destination" to doc.getString("destination"),
            "enabled" to (doc["enabled"] as? Boolean ?: false),
            "portfolioId" to doc.getObjectId("portfolioId")?.toHexString(),
            "createdAt" to BsonJson.value(doc["createdAt"]).toString(),
            "updatedAt" to BsonJson.value(doc["updatedAt"]).toString(),
        )
}
