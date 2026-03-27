package com.atxfinance.backend.admin

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.identity.CoreUserService
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.dao.DuplicateKeyException
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.Date
import java.util.regex.Pattern

/**
 * Global-admin portfolio shell (parity with Next.js `src/app/api/admin/portfolios` routes).
 */
@Service
class AdminPortfoliosService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val coreUserService: CoreUserService,
) {
    private val brokerTypeRe = Pattern.compile("^[a-z][a-z0-9_]{0,31}$")
    private val riskProfiles = setOf("conservative", "balanced", "growth")

    fun listPortfoliosWithStats(limit: Int): List<Map<String, Any?>> {
        val lim = limit.coerceIn(1, 500)
        val q =
            Query()
                .with(Sort.by(Sort.Direction.DESC, "updatedAt"))
                .limit(lim)
        val rows = mongoTemplate.find(q, Document::class.java, props.portfoliosCollection)
        val ownerIds = rows.mapNotNull { portfolioUserIdString(it) }.distinct()
        val users = coreUserService.loadUsersForSummaries(ownerIds)
        return rows.map { p ->
            val stats = accountStatsForPortfolio(p)
            val uid = portfolioUserIdString(p)
            val u = uid?.let { users[it] }
            serializePortfolioRow(p).toMutableMap().apply {
                put("accountCount", stats.first)
                put("totalCashBalance", stats.second)
                put("userDisplayName", formatUserDisplayName(u))
                put("userEmail", u?.getString("email"))
            }
        }
    }

    fun getPortfolioWithStats(portfolioId: String): Map<String, Any?>? {
        if (!ObjectId.isValid(portfolioId)) {
            return null
        }
        val p = mongoTemplate.findById(ObjectId(portfolioId), Document::class.java, props.portfoliosCollection)
            ?: return null
        val stats = accountStatsForPortfolio(p)
        return serializePortfolioRow(p).toMutableMap().apply {
            put("accountCount", stats.first)
            put("totalCashBalance", stats.second)
        }
    }

    fun createPortfolio(
        session: ResolvedSession,
        body: Map<String, Any?>,
    ): Result {
        val userId = (body["userId"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
            ?: return Result.Err(400, "Invalid request payload", mapOf("message" to "userId required"))
        val name = (body["name"] as? String)?.trim()?.takeIf { it.isNotEmpty() }?.take(200)
            ?: return Result.Err(400, "Invalid request payload", mapOf("message" to "name required"))
        val isDefault = body["isDefault"] == true
        val tenantRaw = (body["tenantId"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
        val tenantId = tenantRaw ?: session.tenantId.takeIf { it.isNotBlank() }
        val brokerType = parseBrokerType(body["broker_type"])
        val now = Date()
        val tenantOid = PortfolioMongoFilter.tenantObjectId(tenantId ?: "")
        if (isDefault) {
            val base = Criteria.where("isDefault").`is`(true).andOperator(PortfolioMongoFilter.userIdCriteria(userId))
            val crit = PortfolioMongoFilter.strictWriteTenantCriteria(base, tenantId)
            mongoTemplate.updateMulti(
                Query.query(crit),
                Update().set("isDefault", false).set("updatedAt", now),
                props.portfoliosCollection,
            )
        }
        val doc = Document()
        doc["userId"] = userId
        doc["name"] = name
        doc["isDefault"] = isDefault
        doc["tenantPortfolioOrgKey"] = props.tenantPortfolioOrgKey
        doc["createdAt"] = now
        doc["updatedAt"] = now
        if (tenantOid != null) {
            doc["tenantId"] = tenantOid
        }
        if (brokerType != null) {
            doc["broker_type"] = brokerType
        }
        return try {
            mongoTemplate.insert(doc, props.portfoliosCollection)
            val id = doc.getObjectId("_id") ?: return Result.Err(500, "Could not create portfolio", emptyMap())
            val saved =
                mongoTemplate.findById(id, Document::class.java, props.portfoliosCollection)
                    ?: return Result.Err(500, "Could not create portfolio", emptyMap())
            Result.Created(serializePortfolioRow(saved))
        } catch (_: DuplicateKeyException) {
            Result.Err(400, "Could not create portfolio (duplicate name or invalid user?)", emptyMap())
        }
    }

    fun patchPortfolio(portfolioId: String, body: Map<String, Any?>): Result {
        if (!ObjectId.isValid(portfolioId)) {
            return Result.Err(400, "Invalid request payload", mapOf("message" to "invalid portfolio id"))
        }
        val existing =
            mongoTemplate.findById(ObjectId(portfolioId), Document::class.java, props.portfoliosCollection)
                ?: return Result.Err(404, "Portfolio not found", emptyMap())
        val pid = existing.getObjectId("_id")!!
        val now = Date()
        val upd = Update().set("updatedAt", now)
        var changed = false
        val name = body["name"] as? String
        if (name != null && name.trim().isNotEmpty()) {
            upd.set("name", name.trim().take(200))
            changed = true
        }
        if (body.containsKey("ext_broker_ref")) {
            val v = body["ext_broker_ref"]
            when (v) {
                null -> upd.set("ext_broker_ref", null)
                is String -> {
                    val t = v.trim()
                    upd.set("ext_broker_ref", if (t.isEmpty()) null else t.take(128))
                }
            }
            changed = true
        }
        if (body.containsKey("broker_type")) {
            when (val v = body["broker_type"]) {
                null -> upd.set("broker_type", null)
                is String -> {
                    val raw = v.trim().lowercase().take(32)
                    if (!brokerTypeRe.matcher(raw).matches()) {
                        return Result.Err(400, "Unknown broker_type", emptyMap())
                    }
                    upd.set("broker_type", raw)
                }
            }
            changed = true
        }
        if (body.containsKey("riskProfile")) {
            when (val v = body["riskProfile"]) {
                null -> upd.set("riskProfile", null)
                is String -> {
                    val r = v.trim().lowercase()
                    if (!riskProfiles.contains(r)) {
                        return Result.Err(400, "Invalid request payload", emptyMap())
                    }
                    upd.set("riskProfile", r)
                }
            }
            changed = true
        }
        if (body.containsKey("outlook")) {
            when (val v = body["outlook"]) {
                null -> upd.set("outlook", null)
                is String -> {
                    val o = v.trim()
                    upd.set("outlook", if (o.isEmpty()) null else o.take(4000))
                }
            }
            changed = true
        }
        if (body.containsKey("scoringFactors")) {
            when (val v = body["scoringFactors"]) {
                null -> {
                    upd.unset("scoringFactors")
                    changed = true
                }
                is List<*> -> {
                    val parsed =
                        AdminPortfolioScoringSupport.parseAndValidateList(v)
                            ?: return Result.Err(
                                400,
                                "Invalid request payload",
                                mapOf("message" to "invalid scoringFactors"),
                            )
                    upd.set("scoringFactors", AdminPortfolioScoringSupport.toBsonDocuments(parsed))
                    changed = true
                }
                else ->
                    return Result.Err(
                        400,
                        "Invalid request payload",
                        mapOf("message" to "invalid scoringFactors"),
                    )
            }
        }
        val setDefault = body["isDefault"] == true
        val hasPayload =
            changed || setDefault
        if (!hasPayload) {
            return Result.Err(400, "At least one field is required", emptyMap())
        }
        if (changed) {
            mongoTemplate.updateFirst(Query.query(Criteria.where("_id").`is`(pid)), upd, props.portfoliosCollection)
        }
        if (setDefault) {
            val ownerId = portfolioUserIdString(existing) ?: return Result.Err(404, "Portfolio not found", emptyMap())
            val tenantHex = portfolioTenantIdHex(existing)
            val base =
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(ownerId),
                    Criteria.where("isDefault").`is`(true),
                    Criteria.where("_id").ne(pid),
                )
            val crit = PortfolioMongoFilter.strictWriteTenantCriteria(base, tenantHex)
            mongoTemplate.updateMulti(
                Query.query(crit),
                Update().set("isDefault", false).set("updatedAt", now),
                props.portfoliosCollection,
            )
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(pid)),
                Update().set("isDefault", true).set("updatedAt", now),
                props.portfoliosCollection,
            )
        }
        val updated =
            mongoTemplate.findById(pid, Document::class.java, props.portfoliosCollection)
                ?: return Result.Err(404, "Portfolio not found", emptyMap())
        return Result.Ok(serializePortfolioRow(updated))
    }

    fun deletePortfolio(portfolioId: String): Boolean {
        if (!ObjectId.isValid(portfolioId)) {
            return false
        }
        val portfolio =
            mongoTemplate.findById(ObjectId(portfolioId), Document::class.java, props.portfoliosCollection)
                ?: return false
        val pid = portfolio.getObjectId("_id") ?: return false
        val ownerId = portfolioUserIdString(portfolio) ?: return false
        val uidCrit = PortfolioMongoFilter.userIdCriteria(ownerId)
        val pf = Criteria.where("portfolioId").`is`(pid).andOperator(uidCrit)
        mongoTemplate.remove(Query.query(pf), props.positionsCollection)
        mongoTemplate.remove(Query.query(pf), props.portfolioRecommendationsCollection)
        mongoTemplate.remove(Query.query(pf), "portfolio_alerts")
        mongoTemplate.remove(Query.query(pf), "portfolio_delivery_channels")
        mongoTemplate.remove(Query.query(pf), props.accountsCollection)
        mongoTemplate.remove(Query.query(pf), props.watchlistsCollection)
        val res = mongoTemplate.remove(Query.query(Criteria.where("_id").`is`(pid)), props.portfoliosCollection)
        return res.deletedCount == 1L
    }

    private fun accountStatsForPortfolio(p: Document): Pair<Int, Double> {
        val pid = p.getObjectId("_id") ?: return 0 to 0.0
        val owner = portfolioUserIdString(p) ?: return 0 to 0.0
        val tenantHex = portfolioTenantIdHex(p)
        val accounts = listAccountsForOwnerPortfolio(pid, owner, tenantHex)
        val total =
            accounts.sumOf { acc ->
                val n = acc["cashBalance"] as? Number
                if (n != null && n.toDouble().isFinite() && n.toDouble() >= 0) n.toDouble() else props.defaultAccountCashBalance
            }
        return accounts.size to total
    }

    private fun listAccountsForOwnerPortfolio(
        portfolioId: ObjectId,
        ownerUserId: String,
        tenantHex: String?,
    ): List<Document> {
        val base =
            Criteria().andOperator(
                Criteria.where("portfolioId").`is`(portfolioId),
                PortfolioMongoFilter.userIdCriteria(ownerUserId),
            )
        val criteria = PortfolioMongoFilter.withTenantScopeCriteria(base, tenantHex)
        val q = Query.query(criteria)
        q.with(Sort.by(Sort.Order.desc("isDefault"), Sort.Order.asc("createdAt")))
        return mongoTemplate.find(q, Document::class.java, props.accountsCollection)
    }

    private fun serializePortfolioRow(p: Document): Map<String, Any?> {
        val id = p.getObjectId("_id")!!
        return mapOf(
            "_id" to id.toHexString(),
            "tenantId" to (p.getObjectId("tenantId")?.toHexString()),
            "userId" to (portfolioUserIdString(p) ?: ""),
            "name" to (p.getString("name") ?: ""),
            "isDefault" to (p["isDefault"] as? Boolean ?: false),
            "tenantPortfolioOrgKey" to (p.getString("tenantPortfolioOrgKey") ?: props.tenantPortfolioOrgKey),
            "ext_broker_ref" to p["ext_broker_ref"],
            "broker_type" to p["broker_type"],
            "riskProfile" to p["riskProfile"],
            "outlook" to p["outlook"],
            "scoringFactors" to AdminPortfolioScoringSupport.scoringFactorsForApi(p["scoringFactors"]),
            "createdAt" to iso(p["createdAt"]),
            "updatedAt" to iso(p["updatedAt"]),
        )
    }

    private fun parseBrokerType(raw: Any?): String? {
        if (raw == null) {
            return null
        }
        val s = (raw as? String)?.trim()?.lowercase()?.take(32) ?: return null
        return if (brokerTypeRe.matcher(s).matches()) s else null
    }

    private fun portfolioUserIdString(portfolio: Document): String? {
        val v = portfolio["userId"] ?: return null
        return when (v) {
            is String -> v.takeIf { it.isNotBlank() }
            is ObjectId -> v.toHexString()
            else -> null
        }
    }

    private fun portfolioTenantIdHex(portfolio: Document): String? {
        val v = portfolio["tenantId"] ?: return null
        return when (v) {
            is ObjectId -> v.toHexString()
            is String -> v.takeIf { ObjectId.isValid(it) }
            else -> null
        }
    }

    private fun formatUserDisplayName(u: Document?): String {
        if (u == null) {
            return "Unknown user"
        }
        val x = u["xAccount"] as? Document
        val fromX =
            x?.getString("displayName")?.trim()?.takeIf { it.isNotEmpty() }
                ?: x?.getString("username")?.trim()?.takeIf { it.isNotEmpty() }
        if (fromX != null) {
            return fromX
        }
        return u.getString("email")?.takeIf { it.isNotEmpty() } ?: "Unknown user"
    }

    private fun iso(v: Any?): String =
        when (v) {
            is Date -> v.toInstant().toString()
            is Number -> Date(v.toLong()).toInstant().toString()
            is String -> runCatching { Instant.parse(v).toString() }.getOrElse { Instant.now().toString() }
            else -> Instant.now().toString()
        }

    sealed class Result {
        data class Ok(val data: Map<String, Any?>) : Result()
        data class Created(val data: Map<String, Any?>) : Result()
        data class Err(val status: Int, val error: String, val details: Map<String, Any?>) : Result()
    }
}
