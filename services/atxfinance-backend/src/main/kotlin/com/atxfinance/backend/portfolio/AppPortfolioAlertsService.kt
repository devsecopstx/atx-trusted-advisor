package com.atxfinance.backend.portfolio

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.recommendation.MongoQuerySupport
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import java.util.Date

/**
 * App-user `portfolio_alerts` writes for BFF parity with Next `POST /api/portfolios/{id}/alerts`.
 * Desk channel fan-out (Slack/email) after create remains **Next-only** when the handler runs locally;
 * BFF POST persists Mongo rows only.
 */
@Service
class AppPortfolioAlertsService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val portfolioCrudService: PortfolioCrudService,
) {

    fun createForAppUser(session: ResolvedSession, portfolioId: String, body: Map<String, Any?>): Document {
        if (!ObjectId.isValid(portfolioId)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid portfolio id")
        }
        val portfolio = portfolioCrudService.findPortfolioForSessionUser(portfolioId, session)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Portfolio not found")
        val pid = portfolio.getObjectId("_id") ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Portfolio not found")
        val title =
            (body["title"] as? String)?.trim()?.take(200)?.takeIf { it.isNotEmpty() }
                ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid request payload")
        val bodyText = (body["body"] as? String)?.trim()?.take(4000)?.takeIf { it.isNotEmpty() }
        val severityRaw = (body["severity"] as? String)?.trim()?.lowercase()
        val severity =
            when (severityRaw) {
                "info", "warning", "critical" -> severityRaw
                null, "" -> "info"
                else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid request payload")
            }
        val symbol =
            (body["symbol"] as? String)?.trim()?.uppercase()?.take(32)?.takeIf { it.isNotEmpty() }
        val accHex = (body["accountId"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
        var accountOid: ObjectId? = null
        var accountName: String? = null
        if (!accHex.isNullOrEmpty()) {
            if (!ObjectId.isValid(accHex)) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid request payload")
            }
            val wanted = ObjectId(accHex)
            val accounts = portfolioCrudService.listAccountsForPortfolio(pid, session)
            val acct = accounts.find { it.getObjectId("_id") == wanted }
            if (acct == null) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Account not found in this portfolio")
            }
            accountOid = wanted
            val n = acct.getString("name")?.trim()
            accountName = n?.take(120)?.takeIf { it.isNotEmpty() }
        }
        val portfolioName = portfolio.getString("name")?.trim()?.take(120)?.takeIf { it.isNotEmpty() }
        val now = Date()
        val doc = Document()
        MongoQuerySupport.tenantObjectId(session.tenantId)?.let { doc["tenantId"] = it }
        doc["userId"] = session.userId
        doc["portfolioId"] = pid
        portfolioName?.let { doc["portfolioName"] = it }
        accountOid?.let { doc["accountId"] = it }
        accountName?.let { doc["accountName"] = it }
        doc["title"] = title
        bodyText?.let { doc["body"] = it }
        doc["severity"] = severity
        doc["status"] = "active"
        symbol?.let { doc["symbol"] = it }
        doc["createdAt"] = now
        doc["updatedAt"] = now
        mongoTemplate.insert(doc, props.portfolioAlertsCollection)
        val id = doc.getObjectId("_id") ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not create alert")
        return mongoTemplate.findById(id, Document::class.java, props.portfolioAlertsCollection)
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not create alert")
    }

    fun toAppUserJson(doc: Document): Map<String, Any?> =
        mapOf(
            "_id" to doc.getObjectId("_id")?.toHexString(),
            "title" to doc.getString("title"),
            "body" to doc.getString("body"),
            "severity" to doc.getString("severity"),
            "status" to doc.getString("status"),
            "symbol" to doc.getString("symbol"),
            "portfolioId" to doc.getObjectId("portfolioId")?.toHexString(),
            "portfolioName" to doc.getString("portfolioName"),
            "accountId" to doc.getObjectId("accountId")?.toHexString(),
            "accountName" to doc.getString("accountName"),
            "metadata" to doc["metadata"]?.let { BsonJson.value(it) },
            "createdAt" to BsonJson.value(doc["createdAt"]).toString(),
            "updatedAt" to BsonJson.value(doc["updatedAt"]).toString(),
        )
}
