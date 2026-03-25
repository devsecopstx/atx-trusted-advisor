package com.atxfinance.backend.admin

import com.atxfinance.backend.config.AtxfinanceProperties
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

/**
 * Global-admin portfolio recommendations (`portfolio_recommendations`), parity with Next
 * `admin/portfolios/[portfolioId]/recommendations`.
 */
@Service
class AdminPortfolioRecommendationsService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val adminPortfolioAccountsService: AdminPortfolioAccountsService,
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
        val q = Query.query(crit).with(Sort.by(Sort.Direction.DESC, "createdAt"))
        return mongoTemplate.find(q, Document::class.java, props.portfolioRecommendationsCollection)
            .map { toJson(it) }
    }

    fun create(portfolioId: String, body: Map<String, Any?>): Document? {
        val scope = adminPortfolioAccountsService.resolvePortfolioOwnerScope(portfolioId) ?: return null
        val pid = scope.portfolio.getObjectId("_id") ?: return null
        val symbol =
            (body["symbol"] as? String)?.trim()?.uppercase()?.take(32)?.takeIf { it.isNotEmpty() }
                ?: return null
        val action =
            (body["action"] as? String)?.trim()?.lowercase()?.takeIf {
                it in setOf("buy", "sell", "hold", "watch")
            } ?: return null
        val note = (body["note"] as? String)?.trim()?.take(2000)?.takeIf { it.isNotEmpty() }
        val accountIdRaw = body["accountId"] as? String
        val accountId =
            accountIdRaw?.trim()?.takeIf { it.isNotEmpty() && ObjectId.isValid(it) }?.let { ObjectId(it) }
        val quantity = (body["quantity"] as? Number)?.toDouble()?.takeIf { it.isFinite() && it > 0 }
        val targetPrice = (body["targetPrice"] as? Number)?.toDouble()?.takeIf { it.isFinite() && it > 0 }
        val now = Date()
        val doc = Document()
        PortfolioMongoFilter.tenantObjectId(scope.tenantIdHex ?: "")?.let { doc["tenantId"] = it }
        doc["userId"] = scope.ownerUserId
        doc["portfolioId"] = pid
        accountId?.let { doc["accountId"] = it }
        doc["symbol"] = symbol
        doc["action"] = action
        note?.let { doc["note"] = it }
        quantity?.let { doc["quantity"] = it }
        targetPrice?.let { doc["targetPrice"] = it }
        doc["status"] = "new"
        doc["createdAt"] = now
        doc["updatedAt"] = now
        mongoTemplate.insert(doc, props.portfolioRecommendationsCollection)
        val id = doc.getObjectId("_id") ?: return null
        return mongoTemplate.findById(id, Document::class.java, props.portfolioRecommendationsCollection)
    }

    fun patch(portfolioId: String, recommendationId: String, body: Map<String, Any?>): Document? {
        if (!ObjectId.isValid(recommendationId)) {
            return null
        }
        val scope = adminPortfolioAccountsService.resolvePortfolioOwnerScope(portfolioId) ?: return null
        val pid = scope.portfolio.getObjectId("_id") ?: return null
        val rid = ObjectId(recommendationId)
        val filter =
            PortfolioMongoFilter.strictWriteTenantCriteria(
                Criteria().andOperator(
                    Criteria.where("_id").`is`(rid),
                    PortfolioMongoFilter.userIdCriteria(scope.ownerUserId),
                    Criteria.where("portfolioId").`is`(pid),
                ),
                scope.tenantIdHex,
            )
        val existing =
            mongoTemplate.findOne(Query.query(filter), Document::class.java, props.portfolioRecommendationsCollection)
                ?: return null
        val now = Date()
        val update = Update()
        var any = false
        if (body.containsKey("symbol")) {
            val sym = (body["symbol"] as? String)?.trim()?.uppercase()?.take(32)?.takeIf { it.isNotEmpty() }
            if (sym != null) {
                update.set("symbol", sym)
                any = true
            }
        }
        if (body.containsKey("action")) {
            val a = (body["action"] as? String)?.trim()?.lowercase()
            if (a in setOf("buy", "sell", "hold", "watch")) {
                update.set("action", a)
                any = true
            }
        }
        if (body.containsKey("note")) {
            any = true
            when (val n = body["note"]) {
                null -> update.unset("note")
                is String -> {
                    val t = n.trim()
                    if (t.isEmpty()) {
                        update.unset("note")
                    } else {
                        update.set("note", t.take(2000))
                    }
                }
            }
        }
        if (body.containsKey("quantity")) {
            any = true
            when (val q = body["quantity"]) {
                null -> update.unset("quantity")
                is Number -> {
                    val d = q.toDouble()
                    if (d.isFinite() && d > 0) {
                        update.set("quantity", d)
                    } else {
                        update.unset("quantity")
                    }
                }
            }
        }
        if (body.containsKey("targetPrice")) {
            any = true
            when (val p = body["targetPrice"]) {
                null -> update.unset("targetPrice")
                is Number -> {
                    val d = p.toDouble()
                    if (d.isFinite() && d > 0) {
                        update.set("targetPrice", d)
                    } else {
                        update.unset("targetPrice")
                    }
                }
            }
        }
        if (body.containsKey("status")) {
            val s = (body["status"] as? String)?.trim()?.lowercase()
            if (s in setOf("new", "accepted", "executed", "dismissed")) {
                update.set("status", s)
                any = true
            }
        }
        if (!any) {
            return existing
        }
        update.set("updatedAt", now)
        mongoTemplate.updateFirst(Query.query(filter), update, props.portfolioRecommendationsCollection)
        return mongoTemplate.findOne(Query.query(filter), Document::class.java, props.portfolioRecommendationsCollection)
    }

    fun delete(portfolioId: String, recommendationId: String): Boolean {
        if (!ObjectId.isValid(recommendationId)) {
            return false
        }
        val scope = adminPortfolioAccountsService.resolvePortfolioOwnerScope(portfolioId) ?: return false
        val pid = scope.portfolio.getObjectId("_id") ?: return false
        val filter =
            PortfolioMongoFilter.strictWriteTenantCriteria(
                Criteria().andOperator(
                    Criteria.where("_id").`is`(ObjectId(recommendationId)),
                    PortfolioMongoFilter.userIdCriteria(scope.ownerUserId),
                    Criteria.where("portfolioId").`is`(pid),
                ),
                scope.tenantIdHex,
            )
        val res = mongoTemplate.remove(Query.query(filter), props.portfolioRecommendationsCollection)
        return res.deletedCount == 1L
    }

    fun toJson(doc: Document): Map<String, Any?> =
        linkedMapOf<String, Any?>().apply {
            put("_id", doc.getObjectId("_id")?.toHexString())
            put("symbol", doc.getString("symbol"))
            put("action", doc.getString("action"))
            put("note", doc.getString("note"))
            put("quantity", (doc["quantity"] as? Number)?.toDouble())
            put("targetPrice", (doc["targetPrice"] as? Number)?.toDouble())
            put("status", doc.getString("status"))
            put("accountId", doc.getObjectId("accountId")?.toHexString())
            put("portfolioId", doc.getObjectId("portfolioId")?.toHexString())
            put("userId", userIdString(doc["userId"]))
            put("createdAt", BsonJson.value(doc["createdAt"]).toString())
            put("updatedAt", BsonJson.value(doc["updatedAt"]).toString())
        }

    private fun userIdString(v: Any?): String =
        when (v) {
            is String -> v
            is ObjectId -> v.toHexString()
            else -> ""
        }
}
