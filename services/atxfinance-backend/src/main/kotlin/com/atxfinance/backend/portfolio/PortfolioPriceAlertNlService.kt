package com.atxfinance.backend.portfolio

import com.atxfinance.backend.admin.AdminPortfolioAlertsService
import com.atxfinance.backend.admin.AdminScheduledTasksService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.identity.CoreUserService
import com.atxfinance.backend.session.ResolvedSession
import com.atxfinance.backend.strategy.StrategyOptionsYahooClient
import com.atxfinance.backend.xchat.AtxFunctionExecutionContext
import com.atxfinance.backend.xchat.XchatPlanLimits
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.stereotype.Service
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.Date

/**
 * JVM parity for Next `price_alert_manage` in [com.atxfinance.backend.xchat.AtxFunctionExecutor]
 * (`portfolio_price_alerts` + optional desk preview rows).
 */
@Service
class PortfolioPriceAlertNlService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val coreUserService: CoreUserService,
    private val portfolioCrudService: PortfolioCrudService,
    private val defaultPortfolioProvisionService: DefaultPortfolioProvisionService,
    private val adminPortfolioAlertsService: AdminPortfolioAlertsService,
    private val adminScheduledTasksService: AdminScheduledTasksService,
    private val yahooClient: StrategyOptionsYahooClient,
) {
    fun executePriceAlertManage(
        args: Map<String, Any?>,
        ctx: AtxFunctionExecutionContext,
    ): Map<String, Any?> {
        val session = ctx.session
        val plan = coreUserService.getById(session.userId)?.getString("subscriptionPlan")
        if (!XchatPlanLimits.canManageNlPriceAlerts(plan, session.roles)) {
            return mapOf(
                "error" to "plan_blocked_nl_price_alerts",
                "message" to
                    "Natural-language price alerts require Premium+ with an advisor seat (global admins included). Use Portfolio → Alerts or upgrade.",
                "alertsDeepLink" to "/portfolio/alerts",
            )
        }
        val workspacePf = resolveWorkspacePortfolioDoc(ctx) ?: return mapOf("error" to "no_default_portfolio")
        val workspacePortfolioIdHex = workspacePf.getObjectId("_id")!!.toHexString()
        val workspaceAlertsDeepLink = deskDeepLink(workspacePortfolioIdHex)

        val op = (args["priceAlertOp"] as? String)?.trim().orEmpty()
        return when (op) {
            "list" -> listOp(session, workspacePortfolioIdHex, workspaceAlertsDeepLink)
            "add" -> addOp(args, session, ctx.portfolioIdHex, workspaceAlertsDeepLink)
            "remove_symbol" -> removeSymbolOp(args, session, workspacePortfolioIdHex, workspaceAlertsDeepLink)
            "clear_all" -> clearAllOp(args, session, workspacePortfolioIdHex, workspaceAlertsDeepLink)
            else ->
                mapOf(
                    "error" to "invalid_price_alert_op",
                    "priceAlertOp" to op.ifEmpty { null },
                    "alertsDeepLink" to workspaceAlertsDeepLink,
                )
        }
    }

    private fun deskDeepLink(portfolioIdHex: String): String =
        "/portfolio/alerts?portfolioId=" + URLEncoder.encode(portfolioIdHex, StandardCharsets.UTF_8)

    private fun resolveWorkspacePortfolioDoc(ctx: AtxFunctionExecutionContext): Document? {
        val explicit = ctx.portfolioIdHex?.trim()?.takeIf { ObjectId.isValid(it) }
        if (explicit != null) {
            return portfolioCrudService.findPortfolioForSessionUser(explicit, ctx.session)
        }
        return defaultPortfolioProvisionService.getDefaultPortfolioDoc(ctx.session)
    }

    private fun userActiveNlCriteria(session: ResolvedSession): Criteria {
        val uid = PortfolioMongoFilter.userIdCriteria(session.userId)
        val tenantOid = PortfolioMongoFilter.tenantObjectId(session.tenantId)
        val tenantScope =
            if (tenantOid != null) {
                Criteria().orOperator(
                    Criteria.where("tenantId").`is`(tenantOid),
                    Criteria.where("tenantId").`is`(null),
                    Criteria.where("tenantId").exists(false),
                )
            } else {
                Criteria()
            }
        return Criteria().andOperator(
            uid,
            tenantScope,
            Criteria.where("status").`is`("active"),
        )
    }

    private fun listActiveForUser(session: ResolvedSession): List<Document> {
        val q =
            Query.query(userActiveNlCriteria(session))
                .with(Sort.by(Sort.Direction.ASC, "symbolNorm"))
                .limit(200)
        return mongoTemplate.find(q, Document::class.java, props.portfolioPriceAlertsCollection)
    }

    private fun countActiveForTenantStrict(tenantHex: String): Long {
        val oid = PortfolioMongoFilter.tenantObjectId(tenantHex) ?: return 0
        return mongoTemplate.count(
            Query.query(Criteria.where("tenantId").`is`(oid).and("status").`is`("active")),
            props.portfolioPriceAlertsCollection,
        )
    }

    private fun deleteActiveForUserSymbol(
        session: ResolvedSession,
        symbolUpper: String,
    ): Long {
        val sym = normSymbol(symbolUpper)
        if (sym.isEmpty()) {
            return 0
        }
        val crit =
            Criteria().andOperator(
                userActiveNlCriteria(session),
                Criteria.where("symbolNorm").`is`(sym),
            )
        val res = mongoTemplate.remove(Query.query(crit), props.portfolioPriceAlertsCollection)
        return res.deletedCount
    }

    private fun deleteAllActiveForUser(session: ResolvedSession): Long {
        val res =
            mongoTemplate.remove(
                Query.query(userActiveNlCriteria(session)),
                props.portfolioPriceAlertsCollection,
            )
        return res.deletedCount
    }

    private fun normSymbol(raw: String): String =
        raw.trim().uppercase().take(32)

    private fun listOp(
        session: ResolvedSession,
        workspacePortfolioIdHex: String,
        alertsDeepLink: String,
    ): Map<String, Any?> {
        val active = listActiveForUser(session)
        val deskRows = adminPortfolioAlertsService.list(workspacePortfolioIdHex).orEmpty()
        val recentDesk = mutableListOf<Map<String, Any?>>()
        for (r in deskRows) {
            val meta = r["metadata"]
            if (isArmedNlUserPriceRule(meta)) {
                continue
            }
            if (recentDesk.size >= 8) {
                break
            }
            val id = r["_id"]?.toString()?.trim().orEmpty()
            val title = r["title"]?.toString()?.trim().orEmpty()
            val symbol = r["symbol"]?.toString()?.trim()?.takeIf { it.isNotEmpty() }
            recentDesk.add(
                mapOf(
                    "id" to id,
                    "title" to title,
                    "symbol" to symbol,
                ),
            )
        }
        return mapOf(
            "portfolioId" to workspacePortfolioIdHex,
            "alertsDeepLink" to alertsDeepLink,
            "activeAlertCount" to active.size,
            "activeAlerts" to
                active.map { a ->
                    mapOf(
                        "id" to a.getObjectId("_id")?.toHexString(),
                        "symbol" to a.getString("symbolNorm"),
                        "ruleKind" to a.getString("ruleKind"),
                        "targetPriceUsd" to (a["targetPriceUsd"] as? Number)?.toDouble(),
                        "portfolioId" to a.getObjectId("portfolioId")?.toHexString(),
                        "portfolioName" to a.getString("portfolioName"),
                        "expiresAt" to (a.getDate("expiresAt")?.toInstant()?.toString()),
                    )
                },
            "recentDeskAlerts" to recentDesk,
            "note" to
                "Active alerts live in portfolio_price_alerts (one per symbol per user). Evaluated on tenant watchlist scans plus the user_alert_manager scheduled task.",
        )
    }

    private fun isArmedNlUserPriceRule(metadata: Any?): Boolean {
        val m = metadata as? Document ?: return false
        if (m.getString("source") != "xchat_user_price_rule") {
            return false
        }
        return m.getString("ruleState") == "armed"
    }

    private fun resolvePortfolioHint(
        session: ResolvedSession,
        portfolioHintRaw: String?,
        workspacePortfolioIdHex: String?,
    ): PortfolioHintResolution {
        val portfolios = portfolioCrudService.listPortfoliosForSessionUser(session)
        val hint = portfolioHintRaw?.trim()?.lowercase().orEmpty()

        fun workspaceOrDefault(): PortfolioHintResolution {
            val ws = workspacePortfolioIdHex?.trim()?.takeIf { ObjectId.isValid(it) }
            if (ws != null) {
                val wsPf = portfolioCrudService.findPortfolioForSessionUser(ws, session)
                val id = wsPf?.getObjectId("_id")?.toHexString()
                if (id != null) {
                    return PortfolioHintResolution.Ok(id, wsPf.getString("name")?.trim().orEmpty().ifEmpty { "Portfolio" })
                }
            }
            val def = portfolios.firstOrNull { it.getBoolean("isDefault") == true } ?: portfolios.firstOrNull()
            val pid = def?.getObjectId("_id")?.toHexString()
                ?: return PortfolioHintResolution.NotFound
            return PortfolioHintResolution.Ok(pid, def.getString("name")?.trim().orEmpty().ifEmpty { "Portfolio" })
        }

        if (hint.isEmpty()) {
            return workspaceOrDefault()
        }

        data class Match(val portfolioIdHex: String, val portfolioName: String, val label: String)

        val matches = mutableListOf<Match>()
        for (pf in portfolios) {
            val pid = pf.getObjectId("_id")?.toHexString() ?: continue
            val pname = (pf.getString("name") ?: "").trim().lowercase()
            if (pname.contains(hint) || hint.contains(pname)) {
                matches.add(
                    Match(
                        portfolioIdHex = pid,
                        portfolioName = pf.getString("name")?.trim().orEmpty().ifEmpty { "Portfolio" },
                        label = "Portfolio \"${pf.getString("name")?.trim().orEmpty()}\"",
                    ),
                )
                continue
            }
            val accounts = portfolioCrudService.listAccountsForPortfolio(ObjectId(pid), session)
            for (a in accounts) {
                val an = (a.getString("name") ?: "").trim().lowercase()
                if (an.isEmpty()) {
                    continue
                }
                if (an.contains(hint) || hint.contains(an)) {
                    matches.add(
                        Match(
                            portfolioIdHex = pid,
                            portfolioName = pf.getString("name")?.trim().orEmpty().ifEmpty { "Portfolio" },
                            label = "Account \"${a.getString("name")?.trim()}\" (${pf.getString("name")?.trim().orEmpty()})",
                        ),
                    )
                    break
                }
            }
        }
        val uniq = matches.distinctBy { it.portfolioIdHex }
        return when {
            uniq.size == 1 -> PortfolioHintResolution.Ok(uniq[0].portfolioIdHex, uniq[0].portfolioName)
            uniq.isEmpty() -> PortfolioHintResolution.NotFound
            else ->
                PortfolioHintResolution.Ambiguous(
                    uniq.map { mapOf("portfolioIdHex" to it.portfolioIdHex, "label" to it.label) },
                )
        }
    }

    private sealed class PortfolioHintResolution {
        data class Ok(val portfolioIdHex: String, val portfolioName: String) : PortfolioHintResolution()

        data object NotFound : PortfolioHintResolution()

        data class Ambiguous(val candidates: List<Map<String, String>>) : PortfolioHintResolution()
    }

    private fun addOp(
        args: Map<String, Any?>,
        session: ResolvedSession,
        workspacePortfolioIdFromRequest: String?,
        workspaceAlertsDeepLinkDefault: String,
    ): Map<String, Any?> {
        val hintRaw =
            (args["portfolioHint"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
                ?: (args["portfolioName"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
                ?: (args["inPortfolio"] as? String)?.trim()?.takeIf { it.isNotEmpty() }

        val wsHex = workspacePortfolioIdFromRequest?.trim()?.takeIf { ObjectId.isValid(it) }
        when (val resolved = resolvePortfolioHint(session, hintRaw, wsHex)) {
            is PortfolioHintResolution.NotFound ->
                return mapOf(
                    "error" to "portfolio_hint_not_found",
                    "alertsDeepLink" to workspaceAlertsDeepLinkDefault,
                )
            is PortfolioHintResolution.Ambiguous ->
                return mapOf(
                    "error" to "portfolio_hint_ambiguous",
                    "candidates" to resolved.candidates,
                    "alertsDeepLink" to workspaceAlertsDeepLinkDefault,
                )
            is PortfolioHintResolution.Ok -> {
                val portfolioId = resolved.portfolioIdHex
                val alertsDeepLink = deskDeepLink(portfolioId)

                val validSym = parseSingleSymbol(args)
                if (validSym == null) {
                    return mapOf("error" to "invalid_symbol", "alertsDeepLink" to alertsDeepLink)
                }

                val target =
                    parseUsdNumber(args["targetPrice"])
                        ?: parseUsdNumber(args["price"])
                        ?: parseUsdNumber(args["level"])
                if (target == null || target <= 0 || target > 1_000_000) {
                    return mapOf("error" to "invalid_target_price", "alertsDeepLink" to alertsDeepLink)
                }

                val rk = (args["ruleKind"] as? String)?.trim()?.lowercase().orEmpty()
                val ruleKind =
                    when (rk) {
                        "above", "below", "crosses" -> rk
                        else ->
                            return mapOf(
                                "error" to "needs_rule_kind_clarification",
                                "message" to
                                    "Say whether you want the alert when price goes **above**, **below**, or **crosses** the target.",
                                "examples" to
                                    listOf(
                                        "add alert TSLA 420 above",
                                        "add alert NVDA 140 below",
                                        "add alert AMD 175 crosses",
                                    ),
                                "alertsDeepLink" to alertsDeepLink,
                            )
                    }

                val activeBefore = listActiveForUser(session)
                val hadSymbol = activeBefore.any { it.getString("symbolNorm") == validSym }
                if (!hadSymbol && activeBefore.size >= MAX_NL_USER_PRICE_ALERT_RULES) {
                    return mapOf(
                        "error" to "nl_price_alert_rule_cap",
                        "max" to MAX_NL_USER_PRICE_ALERT_RULES,
                        "alertsDeepLink" to alertsDeepLink,
                    )
                }

                val tenantHex = session.tenantId.trim()
                val tenantBefore =
                    if (ObjectId.isValid(tenantHex)) {
                        countActiveForTenantStrict(tenantHex)
                    } else {
                        0L
                    }

                val upsert = upsertActiveNl(session, portfolioId, resolved.portfolioName, validSym, target, ruleKind)
                    ?: return mapOf("error" to "create_failed", "alertsDeepLink" to alertsDeepLink)

                if (ObjectId.isValid(tenantHex)) {
                    val tenantAfter = countActiveForTenantStrict(tenantHex)
                    if (tenantBefore == 0L && tenantAfter > 0L) {
                        adminScheduledTasksService.ensureUserAlertManagerScheduledTaskForTenant(tenantHex)
                    }
                }

                var spotNote: String? = null
                runCatching {
                    val q = yahooClient.fetchUnderlyingQuote(validSym) ?: return@runCatching
                    val px = (q["regularMarketPrice"] as? Number)?.toDouble()
                    if (px != null && px.isFinite()) {
                        spotNote = "Spot ~ $${"%.2f".format(px)} (Yahoo)."
                    }
                }

                return mapOf(
                    "ok" to true,
                    "portfolioId" to portfolioId,
                    "alertsDeepLink" to alertsDeepLink,
                    "ruleDocId" to upsert.getObjectId("_id")?.toHexString(),
                    "symbol" to validSym,
                    "targetPriceUsd" to target,
                    "ruleKind" to ruleKind,
                    "replaced" to (upsert["replacedFlag"] == true),
                    "spotNote" to spotNote,
                    "deliveryNote" to
                        "When this rule fires, we create a portfolio desk alert and may send Premium+ advisor branded email when desk SMTP is configured.",
                )
            }
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun parseSingleSymbol(args: Map<String, Any?>): String? {
        val fromList =
            (args["symbols"] as? List<*>)
                ?.firstOrNull()
                ?.toString()
                ?.trim()
                ?.uppercase()
                .orEmpty()
        val raw =
            fromList.ifEmpty {
                (args["symbol"] as? String)?.trim()?.uppercase().orEmpty()
            }
        return raw.takeIf { SYMBOL_RE.matches(it) }
    }

    private fun parseUsdNumber(v: Any?): Double? =
        when (v) {
            is Number -> v.toDouble().takeIf { it.isFinite() }
            is String -> v.trim().toDoubleOrNull()?.takeIf { it.isFinite() }
            else -> null
        }

    private fun upsertActiveNl(
        session: ResolvedSession,
        portfolioIdHex: String,
        portfolioName: String,
        symbolUpper: String,
        targetPriceUsd: Double,
        ruleKind: String,
    ): Document? {
        if (!ObjectId.isValid(session.tenantId) || !ObjectId.isValid(portfolioIdHex)) {
            return null
        }
        val tenantOid = ObjectId(session.tenantId)
        val sym = normSymbol(symbolUpper)
        val pfOid = ObjectId(portfolioIdHex)
        val uid = session.userId.trim()

        val existingQ =
            Query.query(
                Criteria().andOperator(
                    userActiveNlCriteria(session),
                    Criteria.where("symbolNorm").`is`(sym),
                ),
            )
        val existing =
            mongoTemplate.findOne(existingQ, Document::class.java, props.portfolioPriceAlertsCollection)
        val now = Date()
        val expiresAt =
            existing?.getDate("expiresAt")?.takeIf { it.after(now) }
                ?: Date(now.time + 30L * 24L * 60L * 60L * 1000L)

        if (existing?.getObjectId("_id") != null) {
            val id = existing.getObjectId("_id")!!
            val update =
                org.springframework.data.mongodb.core.query.Update()
                    .set("tenantId", tenantOid)
                    .set("userId", uid)
                    .set("portfolioId", pfOid)
                    .set("symbol", sym)
                    .set("symbolNorm", sym)
                    .set("targetPriceUsd", targetPriceUsd)
                    .set("ruleKind", ruleKind)
                    .set("status", "active")
                    .set("updatedAt", now)
                    .set("expiresAt", expiresAt)
            if (portfolioName.isNotEmpty()) {
                update.set("portfolioName", portfolioName)
            } else {
                update.unset("portfolioName")
            }
            mongoTemplate.updateFirst(Query.query(Criteria.where("_id").`is`(id)), update, props.portfolioPriceAlertsCollection)
            val saved =
                mongoTemplate.findById(id, Document::class.java, props.portfolioPriceAlertsCollection)
                    ?: return null
            saved["replacedFlag"] = true
            return saved
        }

        val doc = Document()
        doc["tenantId"] = tenantOid
        doc["userId"] = uid
        doc["portfolioId"] = pfOid
        if (portfolioName.isNotEmpty()) {
            doc["portfolioName"] = portfolioName
        }
        doc["symbol"] = sym
        doc["symbolNorm"] = sym
        doc["targetPriceUsd"] = targetPriceUsd
        doc["ruleKind"] = ruleKind
        doc["status"] = "active"
        doc["createdAt"] = now
        doc["updatedAt"] = now
        doc["expiresAt"] = expiresAt
        val ins = mongoTemplate.insert(doc, props.portfolioPriceAlertsCollection)
        val newId = ins.getObjectId("_id") ?: return null
        val saved =
            mongoTemplate.findById(newId, Document::class.java, props.portfolioPriceAlertsCollection)
                ?: return null
        saved["replacedFlag"] = false
        return saved
    }

    private fun removeSymbolOp(
        args: Map<String, Any?>,
        session: ResolvedSession,
        workspacePortfolioIdHex: String,
        workspaceAlertsDeepLink: String,
    ): Map<String, Any?> {
        val validSym = parseSingleSymbol(args)
        if (validSym == null) {
            return mapOf("error" to "invalid_symbol", "alertsDeepLink" to workspaceAlertsDeepLink)
        }
        if (args["confirmDestructive"] != true) {
            return mapOf(
                "needs_confirmation" to true,
                "alertsDeepLink" to workspaceAlertsDeepLink,
                "summary" to "Remove your active NL price alert for $validSym (one alert per symbol for your user).",
                "instruction" to "After the user confirms in chat, call again with confirmDestructive true (same symbol).",
            )
        }
        val n = deleteActiveForUserSymbol(session, validSym)
        return mapOf(
            "ok" to true,
            "portfolioId" to workspacePortfolioIdHex,
            "alertsDeepLink" to workspaceAlertsDeepLink,
            "deletedRules" to n,
            "symbol" to validSym,
        )
    }

    private fun clearAllOp(
        args: Map<String, Any?>,
        session: ResolvedSession,
        workspacePortfolioIdHex: String,
        workspaceAlertsDeepLink: String,
    ): Map<String, Any?> {
        if (args["confirmDestructive"] != true) {
            return mapOf(
                "needs_confirmation" to true,
                "alertsDeepLink" to workspaceAlertsDeepLink,
                "summary" to "Remove every active NL price alert you created via xChat (desk scanner rows stay).",
                "instruction" to "After explicit user confirmation, retry with confirmDestructive true.",
            )
        }
        val n = deleteAllActiveForUser(session)
        return mapOf(
            "ok" to true,
            "portfolioId" to workspacePortfolioIdHex,
            "alertsDeepLink" to workspaceAlertsDeepLink,
            "deletedRules" to n,
        )
    }

    companion object {
        private const val MAX_NL_USER_PRICE_ALERT_RULES = 40
        private val SYMBOL_RE = Regex("^[A-Z0-9.\\-]{1,32}$")
    }
}
