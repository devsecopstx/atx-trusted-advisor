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

/** Global-admin `portfolio_alerts` — parity with Next admin portfolio alerts routes. */
@Service
class AdminPortfolioAlertsService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val adminPortfolioAccountsService: AdminPortfolioAccountsService,
    private val auditEventService: AuditEventService,
) {

    fun list(portfolioId: String): List<Map<String, Any?>>? {
        val scope = adminPortfolioAccountsService.resolvePortfolioOwnerScope(portfolioId) ?: return null
        val pid = scope.portfolio.getObjectId("_id") ?: return null
        val base =
            Criteria().andOperator(
                PortfolioMongoFilter.userIdCriteria(scope.ownerUserId),
                Criteria.where("portfolioId").`is`(pid),
            )
        val crit = PortfolioMongoFilter.withTenantScopeCriteria(base, scope.tenantIdHex)
        val q = Query.query(crit).with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(200)
        return mongoTemplate.find(q, Document::class.java, props.portfolioAlertsCollection).map { toJson(it) }
    }

    fun create(session: ResolvedSession, portfolioId: String, body: Map<String, Any?>): Document? {
        val scope = adminPortfolioAccountsService.resolvePortfolioOwnerScope(portfolioId) ?: return null
        val pid = scope.portfolio.getObjectId("_id") ?: return null
        val title =
            (body["title"] as? String)?.trim()?.take(200)?.takeIf { it.isNotEmpty() } ?: return null
        val bodyText = (body["body"] as? String)?.trim()?.take(4000)?.takeIf { it.isNotEmpty() }
        val severity =
            (body["severity"] as? String)?.trim()?.lowercase()?.takeIf {
                it in setOf("info", "warning", "critical")
            } ?: return null
        val status =
            (body["status"] as? String)?.trim()?.lowercase()?.takeIf {
                it in setOf("active", "acknowledged", "dismissed")
            } ?: "active"
        val symbol =
            (body["symbol"] as? String)?.trim()?.uppercase()?.take(32)?.takeIf { it.isNotEmpty() }
        val now = Date()
        val doc = Document()
        PortfolioMongoFilter.tenantObjectId(scope.tenantIdHex ?: "")?.let { doc["tenantId"] = it }
        doc["userId"] = scope.ownerUserId
        doc["portfolioId"] = pid
        doc["title"] = title
        bodyText?.let { doc["body"] = it }
        doc["severity"] = severity
        doc["status"] = status
        symbol?.let { doc["symbol"] = it }
        @Suppress("UNCHECKED_CAST")
        val meta = body["metadata"] as? Map<String, Any?>
        if (meta != null && meta.isNotEmpty()) {
            doc["metadata"] = Document(meta)
        }
        doc["createdAt"] = now
        doc["updatedAt"] = now
        mongoTemplate.insert(doc, props.portfolioAlertsCollection)
        val id = doc.getObjectId("_id") ?: return null
        val saved = mongoTemplate.findById(id, Document::class.java, props.portfolioAlertsCollection) ?: return null
        auditEventService.insertEvent(
            AdminPortfolioAudit.ENTITY_TYPE,
            portfolioId,
            "alert_created",
            session,
            mapOf(
                "alertId" to id.toHexString(),
                "severity" to severity,
                "title" to title,
            ),
        )
        return saved
    }

    fun patch(session: ResolvedSession, portfolioId: String, alertId: String, body: Map<String, Any?>): Document? {
        if (!ObjectId.isValid(alertId)) {
            return null
        }
        val scope = adminPortfolioAccountsService.resolvePortfolioOwnerScope(portfolioId) ?: return null
        val pid = scope.portfolio.getObjectId("_id") ?: return null
        val aid = ObjectId(alertId)
        val filter =
            PortfolioMongoFilter.strictWriteTenantCriteria(
                Criteria().andOperator(
                    Criteria.where("_id").`is`(aid),
                    PortfolioMongoFilter.userIdCriteria(scope.ownerUserId),
                    Criteria.where("portfolioId").`is`(pid),
                ),
                scope.tenantIdHex,
            )
        val existing =
            mongoTemplate.findOne(Query.query(filter), Document::class.java, props.portfolioAlertsCollection)
                ?: return null
        val now = Date()
        val update = Update()
        var any = false
        if (body.containsKey("title")) {
            val t = (body["title"] as? String)?.trim()?.take(200)?.takeIf { it.isNotEmpty() }
            if (t != null) {
                update.set("title", t)
                any = true
            }
        }
        if (body.containsKey("body")) {
            any = true
            when (val b = body["body"]) {
                null -> update.unset("body")
                is String -> {
                    val t = b.trim()
                    if (t.isEmpty()) {
                        update.unset("body")
                    } else {
                        update.set("body", t.take(4000))
                    }
                }
            }
        }
        if (body.containsKey("severity")) {
            val s = (body["severity"] as? String)?.trim()?.lowercase()
            if (s in setOf("info", "warning", "critical")) {
                update.set("severity", s)
                any = true
            }
        }
        if (body.containsKey("status")) {
            val s = (body["status"] as? String)?.trim()?.lowercase()
            if (s in setOf("active", "acknowledged", "dismissed")) {
                update.set("status", s)
                any = true
            }
        }
        if (body.containsKey("symbol")) {
            any = true
            when (val sym = body["symbol"]) {
                null -> update.unset("symbol")
                is String -> {
                    val t = sym.trim()
                    if (t.isEmpty()) {
                        update.unset("symbol")
                    } else {
                        update.set("symbol", t.uppercase().take(32))
                    }
                }
            }
        }
        if (!any) {
            return existing
        }
        update.set("updatedAt", now)
        mongoTemplate.updateFirst(Query.query(filter), update, props.portfolioAlertsCollection)
        val out = mongoTemplate.findOne(Query.query(filter), Document::class.java, props.portfolioAlertsCollection)
        auditEventService.insertEvent(
            AdminPortfolioAudit.ENTITY_TYPE,
            portfolioId,
            "alert_updated",
            session,
            mapOf("alertId" to alertId),
        )
        return out
    }

    fun delete(session: ResolvedSession, portfolioId: String, alertId: String): Boolean {
        if (!ObjectId.isValid(alertId)) {
            return false
        }
        val scope = adminPortfolioAccountsService.resolvePortfolioOwnerScope(portfolioId) ?: return false
        val pid = scope.portfolio.getObjectId("_id") ?: return false
        val filter =
            PortfolioMongoFilter.strictWriteTenantCriteria(
                Criteria().andOperator(
                    Criteria.where("_id").`is`(ObjectId(alertId)),
                    PortfolioMongoFilter.userIdCriteria(scope.ownerUserId),
                    Criteria.where("portfolioId").`is`(pid),
                ),
                scope.tenantIdHex,
            )
        val res = mongoTemplate.remove(Query.query(filter), props.portfolioAlertsCollection)
        val ok = res.deletedCount == 1L
        if (ok) {
            auditEventService.insertEvent(
                AdminPortfolioAudit.ENTITY_TYPE,
                portfolioId,
                "alert_deleted",
                session,
                mapOf("alertId" to alertId),
            )
        }
        return ok
    }

    fun toJson(doc: Document): Map<String, Any?> =
        mapOf(
            "_id" to doc.getObjectId("_id")?.toHexString(),
            "title" to doc.getString("title"),
            "body" to doc.getString("body"),
            "severity" to doc.getString("severity"),
            "status" to doc.getString("status"),
            "symbol" to doc.getString("symbol"),
            "portfolioId" to doc.getObjectId("portfolioId")?.toHexString(),
            "metadata" to doc["metadata"]?.let { BsonJson.value(it) },
            "createdAt" to BsonJson.value(doc["createdAt"]).toString(),
            "updatedAt" to BsonJson.value(doc["updatedAt"]).toString(),
        )
}
