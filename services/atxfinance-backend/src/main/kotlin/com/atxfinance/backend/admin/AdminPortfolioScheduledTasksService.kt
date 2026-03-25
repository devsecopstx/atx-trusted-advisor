package com.atxfinance.backend.admin

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

/**
 * Scheduled tasks scoped to a portfolio (`portfolioId` on `admin_scheduled_tasks`),
 * parity with Next `admin/portfolios/[portfolioId]/tasks`.
 *
 * **Note:** Uses the signed-in global admin's `tenantId` (same as Next), not the portfolio owner's tenant.
 */
@Service
class AdminPortfolioScheduledTasksService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val adminPortfolioAccountsService: AdminPortfolioAccountsService,
    private val adminScheduledTasksService: AdminScheduledTasksService,
) {
    private val categories =
        setOf("sync-broker", "rebalance", "compliance", "notifications", "user-history")

    fun toJson(doc: Document): Map<String, Any?> = adminScheduledTasksService.scheduledTaskToJson(doc)

    fun list(session: ResolvedSession, portfolioId: String): List<Map<String, Any?>>? {
        if (!ObjectId.isValid(portfolioId)) {
            return null
        }
        if (adminPortfolioAccountsService.findPortfolioById(portfolioId) == null) {
            return null
        }
        val pid = ObjectId(portfolioId)
        val base =
            Criteria().andOperator(
                Criteria.where("portfolioId").`is`(pid),
            )
        val crit = PortfolioMongoFilter.withTenantScopeCriteria(base, session.tenantId.takeIf { it.isNotBlank() })
        val q =
            Query.query(crit)
                .with(Sort.by(Sort.Direction.ASC, "name"))
                .limit(50)
        return mongoTemplate.find(q, Document::class.java, props.scheduledTasksCollection)
            .map { adminScheduledTasksService.scheduledTaskToJson(it) }
    }

    fun create(session: ResolvedSession, portfolioId: String, body: Map<String, Any?>): Document? {
        if (!ObjectId.isValid(portfolioId)) {
            return null
        }
        if (adminPortfolioAccountsService.findPortfolioById(portfolioId) == null) {
            return null
        }
        val name = (body["name"] as? String)?.trim()?.take(200)?.takeIf { it.isNotEmpty() } ?: return null
        val category =
            (body["category"] as? String)?.trim()?.lowercase()?.takeIf { it in categories } ?: return null
        val scheduleCron =
            (body["scheduleCron"] as? String)?.trim()?.takeIf { it.length >= 5 && it.length <= 128 } ?: return null
        val enabled = body["enabled"] as? Boolean ?: true
        val now = Date()
        val nextRunAt = parseDate(body["nextRunAt"]) ?: Date(now.time + FIVE_MIN_MS)
        val doc = Document()
        doc["name"] = name
        doc["category"] = category
        doc["scheduleCron"] = scheduleCron
        doc["enabled"] = enabled
        doc["nextRunAt"] = nextRunAt
        doc["portfolioId"] = ObjectId(portfolioId)
        PortfolioMongoFilter.tenantObjectId(session.tenantId)?.let { doc["tenantId"] = it }
        parseDate(body["lastRunAt"])?.let { doc["lastRunAt"] = it }
        mongoTemplate.insert(doc, props.scheduledTasksCollection)
        val id = doc.getObjectId("_id") ?: return null
        return mongoTemplate.findById(id, Document::class.java, props.scheduledTasksCollection)
    }

    fun patch(session: ResolvedSession, portfolioId: String, taskId: String, body: Map<String, Any?>): Document? {
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(taskId)) {
            return null
        }
        if (adminPortfolioAccountsService.findPortfolioById(portfolioId) == null) {
            return null
        }
        val pid = ObjectId(portfolioId)
        val tid = ObjectId(taskId)
        val base =
            Criteria().andOperator(
                Criteria.where("_id").`is`(tid),
                Criteria.where("portfolioId").`is`(pid),
            )
        val filter = PortfolioMongoFilter.withTenantScopeCriteria(base, session.tenantId.takeIf { it.isNotBlank() })
        val existing =
            mongoTemplate.findOne(Query.query(filter), Document::class.java, props.scheduledTasksCollection)
                ?: return null
        val update = Update()
        var any = false
        if (body.containsKey("name")) {
            val n = (body["name"] as? String)?.trim()?.take(200)?.takeIf { it.isNotEmpty() } ?: return null
            update.set("name", n)
            any = true
        }
        if (body.containsKey("category")) {
            val c = (body["category"] as? String)?.trim()?.lowercase()?.takeIf { it in categories } ?: return null
            update.set("category", c)
            any = true
        }
        if (body.containsKey("scheduleCron")) {
            val cr = (body["scheduleCron"] as? String)?.trim()?.takeIf { it.length >= 5 && it.length <= 128 }
                ?: return null
            update.set("scheduleCron", cr)
            any = true
        }
        if (body.containsKey("enabled")) {
            val e = body["enabled"] as? Boolean ?: return null
            update.set("enabled", e)
            any = true
        }
        if (body.containsKey("nextRunAt")) {
            any = true
            when (val v = body["nextRunAt"]) {
                null -> update.set("nextRunAt", null)
                else -> {
                    val d = parseDate(v) ?: return null
                    update.set("nextRunAt", d)
                }
            }
        }
        if (!any) {
            return existing
        }
        update.set("updatedAt", Date())
        mongoTemplate.updateFirst(Query.query(filter), update, props.scheduledTasksCollection)
        return mongoTemplate.findOne(Query.query(filter), Document::class.java, props.scheduledTasksCollection)
    }

    fun delete(session: ResolvedSession, portfolioId: String, taskId: String): Boolean {
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(taskId)) {
            return false
        }
        if (adminPortfolioAccountsService.findPortfolioById(portfolioId) == null) {
            return false
        }
        val pid = ObjectId(portfolioId)
        val tid = ObjectId(taskId)
        val base =
            Criteria().andOperator(
                Criteria.where("_id").`is`(tid),
                Criteria.where("portfolioId").`is`(pid),
            )
        val filter = PortfolioMongoFilter.withTenantScopeCriteria(base, session.tenantId.takeIf { it.isNotBlank() })
        val res = mongoTemplate.remove(Query.query(filter), props.scheduledTasksCollection)
        return res.deletedCount == 1L
    }

    private fun parseDate(value: Any?): Date? =
        when (value) {
            null -> null
            is Date -> value
            is String ->
                try {
                    Date.from(java.time.Instant.parse(value))
                } catch (_: Exception) {
                    null
                }
            else -> null
        }

    companion object {
        private const val FIVE_MIN_MS = 5L * 60L * 1000L
    }
}
