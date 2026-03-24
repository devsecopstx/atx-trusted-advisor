package com.atxfinance.backend.admin

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.Date

/**
 * Global-admin CRUD for custodian accounts under any portfolio (parity with Next
 * `src/app/api/admin/portfolios/[portfolioId]/accounts` routes).
 */
@Service
class AdminPortfolioAccountsService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    private val accountTypes = setOf("merrill", "fidelity", "etrade")
    private val riskProfiles = setOf("conservative", "balanced", "growth")
    private val outlookSlugs = setOf("growth", "income", "balanced", "aggressive")

    fun toAdminAccountJson(
        account: Document,
        portfolioIdHex: String,
        portfolioTenantHex: String?,
    ): Map<String, Any?> {
        val tid = account.getObjectId("tenantId")?.toHexString() ?: portfolioTenantHex
        val outlookRaw = account.getString("outlook")
        val outlook =
            outlookRaw?.trim()?.lowercase()?.takeIf { outlookSlugs.contains(it) }
        return mapOf(
            "_id" to (account.getObjectId("_id")?.toHexString()),
            "tenantId" to tid,
            "userId" to portfolioUserIdStringFromAccount(account),
            "portfolioId" to portfolioIdHex,
            "name" to (account.getString("name") ?: ""),
            "type" to (account.getString("type") ?: "fidelity"),
            "extAccountId" to (account.getString("extAccountId") ?: ""),
            "cashBalance" to ((account["cashBalance"] as? Number)?.toDouble()?.takeIf { it.isFinite() && it >= 0 }
                ?: props.defaultAccountCashBalance),
            "isDefault" to (account["isDefault"] as? Boolean ?: false),
            "riskProfile" to account["riskProfile"],
            "outlook" to outlook,
            "createdAt" to iso(account["createdAt"]),
            "updatedAt" to iso(account["updatedAt"]),
        )
    }

    fun findPortfolioById(portfolioId: String): Document? {
        if (!ObjectId.isValid(portfolioId)) {
            return null
        }
        return mongoTemplate.findById(ObjectId(portfolioId), Document::class.java, props.portfoliosCollection)
    }

    fun buildConsoleJson(portfolioId: String): Map<String, Any?>? {
        val portfolio = findPortfolioById(portfolioId) ?: return null
        val pid = portfolio.getObjectId("_id") ?: return null
        val ownerId = portfolioUserIdString(portfolio) ?: return null
        val tenantHex = portfolioTenantIdHex(portfolio)
        val accounts = listAccountsForOwnerPortfolio(pid, ownerId, tenantHex)
        val totalCash = accounts.sumOf { acc ->
            val n = acc["cashBalance"] as? Number
            if (n != null && n.toDouble().isFinite() && n.toDouble() >= 0) n.toDouble() else props.defaultAccountCashBalance
        }
        return mapOf(
            "portfolio" to
                mapOf(
                    "_id" to pid.toHexString(),
                    "name" to (portfolio.getString("name") ?: ""),
                    "userId" to ownerId,
                    "tenantPortfolioOrgKey" to (portfolio.getString("tenantPortfolioOrgKey") ?: props.tenantPortfolioOrgKey),
                    "riskProfile" to portfolio["riskProfile"],
                    "outlook" to (portfolio.getString("outlook")),
                ),
            "accountCount" to accounts.size,
            "totalCashBalance" to totalCash,
            "accounts" to accounts.map { toAdminAccountJson(it, pid.toHexString(), tenantHex) },
        )
    }

    fun insertAccount(
        portfolioId: String,
        name: String,
        type: String?,
        extAccountId: String?,
        cashBalance: Double?,
    ): Document? {
        val portfolio = findPortfolioById(portfolioId) ?: return null
        val pid = portfolio.getObjectId("_id") ?: return null
        val ownerId = portfolioUserIdString(portfolio) ?: return null
        val tenantHex = portfolioTenantIdHex(portfolio)
        val trimmedName = name.trim().take(200)
        if (trimmedName.isEmpty()) {
            return null
        }
        val accType = type?.trim()?.lowercase()?.takeIf { accountTypes.contains(it) } ?: "fidelity"
        val ext =
            extAccountId?.trim()?.take(200)?.takeIf { it.isNotEmpty() }
                ?: "atx-${ObjectId().toHexString().takeLast(12)}"
        val cash = cashBalance?.takeIf { it.isFinite() && it >= 0 } ?: props.defaultAccountCashBalance
        val now = Date()
        val doc =
            Document(
                mapOf(
                    "userId" to ownerId,
                    "portfolioId" to pid,
                    "name" to trimmedName,
                    "type" to accType,
                    "extAccountId" to ext,
                    "cashBalance" to cash,
                    "isDefault" to false,
                    "createdAt" to now,
                    "updatedAt" to now,
                ),
            )
        PortfolioMongoFilter.tenantObjectId(tenantHex)?.let { doc["tenantId"] = it }
        mongoTemplate.insert(doc, props.accountsCollection)
        val id = doc.getObjectId("_id") ?: return null
        return mongoTemplate.findById(id, Document::class.java, props.accountsCollection)
    }

    fun patchAccount(
        portfolioId: String,
        accountId: String,
        name: String?,
        cashBalance: Double?,
        extAccountId: String?,
        type: String?,
        isDefault: Boolean?,
        riskProfile: Any?,
        riskProfilePresent: Boolean,
        outlook: Any?,
        outlookPresent: Boolean,
    ): Document? {
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(accountId)) {
            return null
        }
        val portfolio = findPortfolioById(portfolioId) ?: return null
        val pid = portfolio.getObjectId("_id") ?: return null
        val ownerId = portfolioUserIdString(portfolio) ?: return null
        val tenantHex = portfolioTenantIdHex(portfolio)
        val aid = ObjectId(accountId)
        val filter =
            accountWriteFilter(aid, pid, ownerId, tenantHex)
        val existing =
            mongoTemplate.findOne(Query.query(filter), Document::class.java, props.accountsCollection)
                ?: return null

        val upd = Update().set("updatedAt", Date())
        var changed = false
        if (name != null && name.trim().isNotEmpty()) {
            upd.set("name", name.trim())
            changed = true
        }
        if (cashBalance != null && cashBalance.isFinite() && cashBalance >= 0) {
            upd.set("cashBalance", cashBalance)
            changed = true
        }
        if (extAccountId != null) {
            val ref = extAccountId.trim()
            if (ref.isNotEmpty()) {
                upd.set("extAccountId", ref)
                changed = true
            }
        }
        if (type != null) {
            val t = type.trim().lowercase()
            if (accountTypes.contains(t)) {
                upd.set("type", t)
                changed = true
            }
        }
        if (isDefault == true) {
            clearDefaultAccountsForPortfolio(pid, ownerId, tenantHex, excludeAccountId = aid)
            upd.set("isDefault", true)
            changed = true
        }
        if (riskProfilePresent) {
            changed = true
            when (riskProfile) {
                null -> upd.unset("riskProfile")
                is String -> {
                    val r = riskProfile.trim().lowercase()
                    if (riskProfiles.contains(r)) {
                        upd.set("riskProfile", r)
                    }
                }
            }
        }
        if (outlookPresent) {
            changed = true
            when (outlook) {
                null -> upd.unset("outlook")
                is String -> {
                    val o = outlook.trim().lowercase()
                    if (outlookSlugs.contains(o)) {
                        upd.set("outlook", o)
                    }
                }
            }
        }

        if (!changed) {
            return existing
        }
        mongoTemplate.updateFirst(Query.query(filter), upd, props.accountsCollection)
        return mongoTemplate.findOne(Query.query(filter), Document::class.java, props.accountsCollection)
    }

    fun deleteAccount(portfolioId: String, accountId: String): Boolean {
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(accountId)) {
            return false
        }
        val portfolio = findPortfolioById(portfolioId) ?: return false
        val pid = portfolio.getObjectId("_id") ?: return false
        val ownerId = portfolioUserIdString(portfolio) ?: return false
        val tenantHex = portfolioTenantIdHex(portfolio)
        val accounts = listAccountsForOwnerPortfolio(pid, ownerId, tenantHex)
        if (accounts.size <= 1) {
            return false
        }
        val aid = ObjectId(accountId)
        val target = accounts.firstOrNull { it.getObjectId("_id") == aid } ?: return false
        if (target.getObjectId("_id") == null) {
            return false
        }
        deletePositionsForAccount(ownerId, tenantHex, pid, aid)
        val delFilter = accountWriteFilter(aid, pid, ownerId, tenantHex)
        val result = mongoTemplate.remove(Query.query(delFilter), props.accountsCollection)
        return result.deletedCount == 1L
    }

    private fun deletePositionsForAccount(
        ownerUserId: String,
        tenantHex: String?,
        portfolioId: ObjectId,
        accountId: ObjectId,
    ) {
        val filter =
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(ownerUserId),
                    Criteria.where("portfolioId").`is`(portfolioId),
                    Criteria.where("accountId").`is`(accountId),
                ),
                tenantHex,
            )
        mongoTemplate.remove(Query.query(filter), props.positionsCollection)
    }

    private fun clearDefaultAccountsForPortfolio(
        portfolioId: ObjectId,
        ownerUserId: String,
        tenantHex: String?,
        excludeAccountId: ObjectId,
    ) {
        val base =
            Criteria().andOperator(
                PortfolioMongoFilter.userIdCriteria(ownerUserId),
                Criteria.where("portfolioId").`is`(portfolioId),
                Criteria.where("_id").ne(excludeAccountId),
            )
        val filter = PortfolioMongoFilter.strictWriteTenantCriteria(base, tenantHex)
        mongoTemplate.updateMulti(
            Query.query(filter),
            Update().set("isDefault", false).set("updatedAt", Date()),
            props.accountsCollection,
        )
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

    private fun accountWriteFilter(
        accountId: ObjectId,
        portfolioId: ObjectId,
        ownerUserId: String,
        tenantHex: String?,
    ): Criteria {
        val base =
            Criteria().andOperator(
                Criteria.where("_id").`is`(accountId),
                PortfolioMongoFilter.userIdCriteria(ownerUserId),
                Criteria.where("portfolioId").`is`(portfolioId),
            )
        return PortfolioMongoFilter.strictWriteTenantCriteria(base, tenantHex)
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

    private fun portfolioUserIdStringFromAccount(a: Document): String {
        val v = a["userId"] ?: return ""
        return when (v) {
            is String -> v
            is ObjectId -> v.toHexString()
            else -> ""
        }
    }

    private fun iso(v: Any?): String =
        when (v) {
            is Date -> v.toInstant().toString()
            is Number -> Date(v.toLong()).toInstant().toString()
            is String -> runCatching { Instant.parse(v).toString() }.getOrElse { Instant.now().toString() }
            else -> Instant.now().toString()
        }
}
