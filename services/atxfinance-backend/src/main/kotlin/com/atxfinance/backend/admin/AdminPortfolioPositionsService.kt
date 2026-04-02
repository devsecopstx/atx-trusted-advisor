package com.atxfinance.backend.admin

import com.atxfinance.backend.audit.AuditEventService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.portfolio.PositionValidationException
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale
import java.util.regex.Pattern

/**
 * Global-admin positions under a portfolio account (parity with Next
 * `.../admin/portfolios/[portfolioId]/accounts/[accountId]/positions/route.ts`).
 */
@Service
class AdminPortfolioPositionsService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val adminPortfolioAccountsService: AdminPortfolioAccountsService,
    private val auditEventService: AuditEventService,
) {
    private val isoDate = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$")

    fun listBundleJson(portfolioId: String, accountId: String): Map<String, Any?>? {
        val pair = adminPortfolioAccountsService.findAccountInPortfolio(portfolioId, accountId) ?: return null
        val (portfolio, account) = pair
        val ownerId = portfolioUserIdString(portfolio) ?: return null
        val tenantHex = portfolioTenantIdHex(portfolio)
        val pid = portfolio.getObjectId("_id") ?: return null
        val aid = account.getObjectId("_id") ?: return null
        val positions = listPositions(ownerId, tenantHex, pid, aid)
        return mapOf(
            "data" to
                mapOf(
                    "portfolioId" to pid.toHexString(),
                    "portfolioName" to (portfolio.getString("name") ?: ""),
                    "portfolioUserId" to ownerId,
                    "account" to
                        mapOf(
                            "_id" to aid.toHexString(),
                            "name" to (account.getString("name") ?: ""),
                            "extAccountId" to (account.getString("extAccountId") ?: ""),
                            "type" to (account.getString("type") ?: "fidelity"),
                            "isDefault" to (account["isDefault"] as? Boolean ?: false),
                        ),
                    "positions" to positions.map { serializePosition(it) },
                ),
        )
    }

    /** Same as Next `serializePosition` + `POST` response `data` object. */
    fun upsertFromBodyReturningApiShape(
        session: ResolvedSession,
        portfolioId: String,
        accountId: String,
        body: Map<String, Any?>,
    ): Map<String, Any?> {
        val doc = upsertFromBody(portfolioId, accountId, body)
        val shape = serializePosition(doc)
        val posId = shape["_id"] as? String
        auditEventService.insertEvent(
            AdminPortfolioAudit.ENTITY_TYPE,
            portfolioId,
            "position_upserted",
            session,
            mapOf(
                "accountId" to accountId,
                "positionId" to posId,
                "positionType" to shape["type"],
                "symbolOrLabel" to (shape["symbol"] ?: shape["label"] ?: ""),
            ),
        )
        return shape
    }

    private fun upsertFromBody(portfolioId: String, accountId: String, body: Map<String, Any?>): Document {
        val pair = adminPortfolioAccountsService.findAccountInPortfolio(portfolioId, accountId)
            ?: throw PositionValidationException(
                PositionValidationException.Code.ACCOUNT_NOT_FOUND,
                "Account not found for portfolio",
            )
        val (portfolio, account) = pair
        val ownerId = portfolioUserIdString(portfolio)
            ?: throw PositionValidationException(
                PositionValidationException.Code.ACCOUNT_NOT_FOUND,
                "Account not found for portfolio",
            )
        val tenantHex = portfolioTenantIdHex(portfolio)
        val pid = portfolio.getObjectId("_id")!!
        val aid = account.getObjectId("_id")!!
        if (!(account.getString("extAccountId") ?: "").trim().isNotEmpty()) {
            throw PositionValidationException(
                PositionValidationException.Code.ACCOUNT_MISSING_EXT_ACCOUNT_ID,
                "Account is missing extAccountId",
            )
        }

        val model = parsePostBody(body)
        return upsertPosition(ownerId, tenantHex, pid, aid, model)
    }

    private data class UpsertModel(
        val positionType: String,
        val symbol: String,
        val qty: Double,
        val avgCost: Double,
        val yahooRef: String?,
        val optionType: String?,
        val strike: Double?,
        val expiration: Date?,
    )

    private fun parsePostBody(body: Map<String, Any?>): UpsertModel {
        val data = body

        when {
            data.containsKey("contracts") -> {
                val symbol = (data["symbol"] as? String)?.trim()?.uppercase()
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "symbol required",
                    )
                val yahooRef = (data["yahooRef"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "yahooRef required",
                    )
                val ot = (data["optionType"] as? String)?.trim()?.lowercase()
                if (ot != "call" && ot != "put") {
                    throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "optionType must be call or put",
                    )
                }
                val strike = positiveDouble(data["strike"])
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "strike required",
                    )
                val expStr = (data["expiration"] as? String)?.trim()
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "expiration required",
                    )
                val exp = expirationUtcFromIsoDate(expStr)
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.INVALID_OPTION_EXPIRATION,
                        "Invalid expiration date",
                    )
                val contracts = positiveDouble(data["contracts"])
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "contracts required",
                    )
                val premium = nonNegDouble(data["premiumPerContract"])
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "premiumPerContract required",
                    )
                return UpsertModel(
                    positionType = "option",
                    symbol = symbol,
                    qty = contracts,
                    avgCost = premium,
                    yahooRef = yahooRef,
                    optionType = ot,
                    strike = strike,
                    expiration = exp,
                )
            }
            data.containsKey("purchasePrice") -> {
                val symbol = (data["symbol"] as? String)?.trim()?.uppercase()
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "symbol required",
                    )
                val shares = positiveDouble(data["shares"])
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "shares required",
                    )
                val purchasePrice = nonNegDouble(data["purchasePrice"])
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "purchasePrice required",
                    )
                return UpsertModel("stock", symbol, shares, purchasePrice, null, null, null, null)
            }
            data.containsKey("amount") -> {
                val amount = nonNegDouble(data["amount"])
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "amount required",
                    )
                val label = (data["label"] as? String)?.trim()?.uppercase()?.takeIf { it.isNotEmpty() } ?: "CASH"
                return UpsertModel("cash", label, 1.0, amount, null, null, null, null)
            }
            else -> {
                val typeStr = (data["type"] as? String)?.trim()?.lowercase() ?: "stock"
                if (typeStr == "option") {
                    throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "Option positions require the detailed payload (yahooRef, strike, expiration, …)",
                    )
                }
                val symbolRaw = (data["symbol"] as? String)?.trim()
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "symbol required",
                    )
                val symbol =
                    if (typeStr == "cash") {
                        (symbolRaw.ifEmpty { "CASH" }).uppercase()
                    } else {
                        symbolRaw.uppercase()
                    }
                val qty = positiveDouble(data["qty"])
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "qty required",
                    )
                val avgCost = nonNegDouble(data["avgCost"])
                    ?: throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "avgCost required",
                    )
                return UpsertModel(typeStr, symbol, qty, avgCost, null, null, null, null)
            }
        }
    }

    private fun upsertPosition(
        ownerUserId: String,
        tenantHex: String?,
        portfolioId: ObjectId,
        accountId: ObjectId,
        input: UpsertModel,
    ): Document {
        val positionType = input.positionType
        val yrefTrim = input.yahooRef?.trim()?.takeIf { it.isNotEmpty() }
        val normalizedUnderlying = input.symbol.trim().uppercase().take(32)
        val cashLabel = (input.symbol.ifEmpty { "CASH" }).uppercase().take(32)

        if (positionType == "stock") {
            if (normalizedUnderlying.isEmpty()) {
                throw PositionValidationException(
                    PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                    "Stock requires a symbol",
                )
            }
            if (input.qty <= 0) {
                throw PositionValidationException(
                    PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                    "Stock requires a positive share count",
                )
            }
        } else if (positionType == "cash") {
            if (input.avgCost < 0) {
                throw PositionValidationException(
                    PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                    "Cash requires a non-negative amount",
                )
            }
        } else if (positionType == "option") {
            if (normalizedUnderlying.isEmpty()) {
                throw PositionValidationException(
                    PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                    "Option requires an underlying symbol",
                )
            }
            if (input.qty <= 0) {
                throw PositionValidationException(
                    PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                    "Option requires a positive contract count",
                )
            }
            if (input.avgCost < 0) {
                throw PositionValidationException(
                    PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                    "Option requires a non-negative premium per contract",
                )
            }
            if (yrefTrim == null) {
                val ot = input.optionType
                if (ot != "call" && ot != "put") {
                    throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "Option requires yahooRef, or call/put + strike + expiration",
                    )
                }
                val strike = input.strike
                if (strike == null || !strike.isFinite() || strike <= 0) {
                    throw PositionValidationException(
                        PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                        "Option requires a positive strike when yahooRef is omitted",
                    )
                }
                val exp = input.expiration
                if (exp == null) {
                    throw PositionValidationException(
                        PositionValidationException.Code.INVALID_OPTION_EXPIRATION,
                        "Option requires a valid expiration date",
                    )
                }
            }
        }

        val effectiveQty = if (positionType == "cash") 1.0 else input.qty
        val now = Date()
        val tenantObjectId = PortfolioMongoFilter.tenantObjectId(tenantHex ?: "")

        val filterCore: Criteria =
            when {
                positionType == "stock" -> {
                    val typeOr =
                        Criteria().orOperator(
                            Criteria.where("type").`is`("stock"),
                            Criteria.where("type").exists(false),
                        )
                    Criteria().andOperator(
                        PortfolioMongoFilter.userIdCriteria(ownerUserId),
                        Criteria.where("portfolioId").`is`(portfolioId),
                        Criteria.where("accountId").`is`(accountId),
                        Criteria.where("symbol").`is`(normalizedUnderlying),
                        typeOr,
                    )
                }
                positionType == "cash" ->
                    Criteria().andOperator(
                        PortfolioMongoFilter.userIdCriteria(ownerUserId),
                        Criteria.where("portfolioId").`is`(portfolioId),
                        Criteria.where("accountId").`is`(accountId),
                        Criteria.where("type").`is`("cash"),
                        Criteria.where("symbol").`is`(cashLabel),
                    )
                yrefTrim != null ->
                    Criteria().andOperator(
                        PortfolioMongoFilter.userIdCriteria(ownerUserId),
                        Criteria.where("portfolioId").`is`(portfolioId),
                        Criteria.where("accountId").`is`(accountId),
                        Criteria.where("type").`is`("option"),
                        Criteria.where("yahooRef").`is`(yrefTrim),
                    )
                else ->
                    Criteria().andOperator(
                        PortfolioMongoFilter.userIdCriteria(ownerUserId),
                        Criteria.where("portfolioId").`is`(portfolioId),
                        Criteria.where("accountId").`is`(accountId),
                        Criteria.where("type").`is`("option"),
                        Criteria.where("symbol").`is`(normalizedUnderlying),
                        Criteria.where("optionType").`is`(input.optionType),
                        Criteria.where("strike").`is`(input.strike),
                        Criteria.where("expiration").`is`(input.expiration),
                    )
            }

        val filter = PortfolioMongoFilter.withTenantScopeCriteria(filterCore, tenantHex)
        val displaySymbol =
            when (positionType) {
                "cash" -> cashLabel
                else -> normalizedUnderlying
            }

        val update =
            Update().apply {
                tenantObjectId?.let { setOnInsert("tenantId", it) }
                setOnInsert("createdAt", now)
                set("userId", ownerUserId)
                set("portfolioId", portfolioId)
                set("accountId", accountId)
                set("symbol", displaySymbol)
                set("qty", effectiveQty)
                set("avgCost", input.avgCost)
                set("type", positionType)
                set("updatedAt", now)
                set("yahooRef", if (positionType == "option" && yrefTrim != null) yrefTrim else null)
                set("optionType", if (positionType == "option") input.optionType else null)
                set("strike", if (positionType == "option") input.strike else null)
                set("expiration", if (positionType == "option") input.expiration else null)
            }

        mongoTemplate.upsert(Query.query(filter), update, props.positionsCollection)
        return mongoTemplate.findOne(Query.query(filter), Document::class.java, props.positionsCollection)
            ?: error("Failed to upsert position")
    }

    private fun listPositions(
        ownerUserId: String,
        tenantHex: String?,
        portfolioId: ObjectId,
        accountId: ObjectId,
    ): List<Document> {
        val filter =
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(ownerUserId),
                    Criteria.where("portfolioId").`is`(portfolioId),
                    Criteria.where("accountId").`is`(accountId),
                ),
                tenantHex,
            )
        val q = Query.query(filter)
        q.with(Sort.by(Sort.Direction.ASC, "createdAt"))
        return mongoTemplate.find(q, Document::class.java, props.positionsCollection)
    }

    private fun serializePosition(p: Document): Map<String, Any?> {
        val t =
            when (p.getString("type")) {
                "cash" -> "cash"
                "option" -> "option"
                else -> "stock"
            }
        val id = p.getObjectId("_id")?.toHexString() ?: ""
        val base =
            linkedMapOf<String, Any?>(
                "_id" to id,
                "type" to t,
                "createdAt" to iso(p["createdAt"]),
                "updatedAt" to iso(p["updatedAt"]),
            )
        val qty = (p["qty"] as? Number)?.toDouble() ?: 0.0
        val avg = (p["avgCost"] as? Number)?.toDouble() ?: 0.0
        return when (t) {
            "stock" ->
                base.apply {
                    put("symbol", p.getString("symbol") ?: "")
                    put("shares", qty)
                    put("purchasePrice", avg)
                }
            "cash" ->
                base.apply {
                    put("label", p.getString("symbol") ?: "")
                    put("amount", avg)
                    put("amountFormatted", formatUsd(avg))
                }
            else -> {
                val exp = p["expiration"]
                val expStr =
                    when (exp) {
                        is Date -> DateTimeFormatter.ISO_LOCAL_DATE.withZone(ZoneOffset.UTC).format(exp.toInstant())
                        else -> null
                    }
                base.apply {
                    put("symbol", p.getString("symbol") ?: "")
                    put("yahooRef", p.getString("yahooRef") ?: "")
                    put("optionType", p["optionType"])
                    put("strike", (p["strike"] as? Number)?.toDouble())
                    put("expiration", expStr)
                    put("contracts", qty)
                    put("premiumPerContract", avg)
                }
            }
        }
    }

    private fun formatUsd(amount: Double): String =
        NumberFormat.getCurrencyInstance(Locale.US).format(amount)

    private fun positiveDouble(v: Any?): Double? =
        when (v) {
            is Number -> v.toDouble().takeIf { it.isFinite() && it > 0 }
            is String -> v.trim().toDoubleOrNull()?.takeIf { it.isFinite() && it > 0 }
            else -> null
        }

    private fun nonNegDouble(v: Any?): Double? =
        when (v) {
            is Number -> v.toDouble().takeIf { it.isFinite() && it >= 0 }
            is String -> v.trim().replace(Regex("[$,\\s]"), "").toDoubleOrNull()?.takeIf { it.isFinite() && it >= 0 }
            else -> null
        }

    private fun expirationUtcFromIsoDate(value: String): Date? {
        if (!isoDate.matcher(value).matches()) {
            return null
        }
        val parsed =
            runCatching {
                LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE)
            }.getOrNull() ?: return null
        val instant = parsed.atStartOfDay(ZoneOffset.UTC).toInstant()
        return Date.from(instant)
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

    private fun iso(v: Any?): String =
        when (v) {
            is Date -> v.toInstant().toString()
            is Number -> Date(v.toLong()).toInstant().toString()
            is String -> runCatching { Instant.parse(v).toString() }.getOrElse { Instant.now().toString() }
            else -> Instant.now().toString()
        }
}
