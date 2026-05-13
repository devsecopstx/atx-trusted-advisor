package com.atxfinance.backend.xchat

import com.atxfinance.backend.identity.CoreUserService
import com.atxfinance.backend.portfolio.DefaultPortfolioProvisionService
import com.atxfinance.backend.portfolio.PortfolioCrudService
import com.atxfinance.backend.portfolio.PositionsService
import com.atxfinance.backend.session.ResolvedSession
import com.atxfinance.backend.strategy.StrategyOptionsYahooClient
import com.fasterxml.jackson.databind.JsonNode
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.regex.Pattern
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

data class OptionsActionScanBuildResult(
    val rows: List<Map<String, Any?>>,
    val planTier: String,
    val truncated: Boolean,
    val isBasicTier: Boolean,
    val asMarkdown: String,
    val generatedAt: String,
)

/**
 * JVM parity with Next `src/modules/xchat/options-action-scan.ts` (per-leg option rows,
 * holding vs watchlist, caps, basic-tier filter).
 */
@Service
class OptionsActionScanService(
    private val coreUserService: CoreUserService,
    private val defaultPortfolioProvisionService: DefaultPortfolioProvisionService,
    private val portfolioCrudService: PortfolioCrudService,
    private val positionsService: PositionsService,
    private val yahooClient: StrategyOptionsYahooClient,
) {
    fun buildScan(
        session: ResolvedSession,
        portfolioIdHex: String?,
        positionsRows: List<Map<String, Any?>>,
        watchlistInner: Map<*, *>?,
    ): OptionsActionScanBuildResult {
        val generatedAt = Instant.now().toString()
        val planCtx = resolvePlanContext(session)
        val portfolioId = resolvePortfolioId(session, portfolioIdHex) ?: return emptyResult(planCtx, generatedAt)

        val accounts = portfolioCrudService.listAccountsForPortfolio(ObjectId(portfolioId), session)
        val accountById = LinkedHashMap<String, String>()
        for (account in accounts) {
            val id = account.getObjectId("_id")?.toHexString() ?: continue
            val label =
                account.getString("name")?.trim()?.takeIf { it.isNotEmpty() }
                    ?: account.getString("extAccountId")?.trim()?.takeIf { it.isNotEmpty() }
                    ?: "Book"
            accountById[id] = label
        }

        val mergedPositions = mergePositionsFromDb(session, portfolioId, accounts, positionsRows)
        val quoteCache = HashMap<String, Double?>()
        val holdingRows = ArrayList<RowCore>()
        for (entry in mergedPositions) {
            val holding = normalizeOptionHolding(entry.row) ?: continue
            val accountHex = entry.accountIdHex
            val portfolioAccountName = accountById[accountHex]
            val market = fetchHoldingMarketSnapshot(holding, quoteCache)
            val action = deriveHoldingAction(holding, market)
            holdingRows.add(
                RowCore(
                    source = "holding",
                    symbol = holding.symbol,
                    strike = holding.strike,
                    exp = holding.expirationIsoDate,
                    type = holding.optionType,
                    qty = holding.qty,
                    portfolioAccountId = accountHex.takeIf { it.isNotEmpty() },
                    portfolioAccountName = portfolioAccountName?.takeIf { accountHex.isNotEmpty() },
                    recommendedAction = action.recommendedAction,
                    why = action.why,
                    urgency = action.urgency,
                    targetWindow = action.targetWindow,
                    confidence = action.confidence,
                ),
            )
        }

        val watchlistRows = ArrayList<RowCore>()
        val holdingSymbols = holdingRows.map { it.symbol }.toSet()
        val symbolsNode = watchlistInner?.get("symbols")
        if (symbolsNode is List<*>) {
            for (raw in symbolsNode) {
                val row = raw as? Map<*, *> ?: continue
                val symbol = row["symbol"]?.toString()?.trim()?.uppercase() ?: continue
                if (symbol.isEmpty() || symbol in holdingSymbols) {
                    continue
                }
                if (!quoteCache.containsKey(symbol)) {
                    val spot = yahooClient.fetchUnderlyingQuote(symbol)?.get("regularMarketPrice") as? Double
                    quoteCache[symbol] = spot?.takeIf { it.isFinite() && it > 0 }
                }
                val entryPrice = (row["entryPrice"] as? Number)?.toDouble()?.takeIf { it.isFinite() }
                val action =
                    deriveWatchlistAction(
                        symbol = symbol,
                        entryPrice = entryPrice,
                        spotPrice = quoteCache[symbol],
                    )
                watchlistRows.add(
                    RowCore(
                        source = "watchlist",
                        symbol = symbol,
                        strike = null,
                        exp = null,
                        type = null,
                        qty = null,
                        portfolioAccountId = null,
                        portfolioAccountName = null,
                        recommendedAction = action.recommendedAction,
                        why = action.why,
                        urgency = action.urgency,
                        targetWindow = action.targetWindow,
                        confidence = action.confidence,
                    ),
                )
            }
        }

        val ranked = chooseHighestUrgency(withApplyRowIds(holdingRows + watchlistRows))
        val resolvedPlanForLimits =
            if (planCtx.isGlobalAdminPath) {
                "basic"
            } else {
                planCtx.resolvedCanonical
            }
        val maxToolCalls = XchatPlanLimits.maxToolCallsForPlan(resolvedPlanForLimits)
        val maxRows =
            if (planCtx.isBasicTier) {
                MAX_BASIC_HOLDINGS_ROWS
            } else {
                min(MAX_PRO_REPORT_ROWS, max(10, maxToolCalls * 4))
            }
        val basicFiltered = if (planCtx.isBasicTier) ranked.filter { it["source"] == "holding" } else ranked
        val rows = basicFiltered.take(maxRows).map { it.toMutableMap() }
        val truncated = basicFiltered.size > rows.size
        val asMarkdown =
            renderMarkdown(
                rows = rows,
                isBasicTier = planCtx.isBasicTier,
                generatedAtIso = generatedAt,
            )
        return OptionsActionScanBuildResult(
            rows = rows,
            planTier = planCtx.planTier,
            truncated = truncated,
            isBasicTier = planCtx.isBasicTier,
            asMarkdown = asMarkdown,
            generatedAt = generatedAt,
        )
    }

    private data class PlanContext(
        val isGlobalAdminPath: Boolean,
        val resolvedCanonical: String,
        val isBasicTier: Boolean,
        val planTier: String,
    )

    private fun resolvePlanContext(session: ResolvedSession): PlanContext {
        val isGlobalAdminPath = session.roles.any { it.equals("global_admin", ignoreCase = true) }
        val raw =
            if (isGlobalAdminPath) {
                null
            } else {
                coreUserService.getById(session.userId)?.getString("subscriptionPlan")
            }
        val resolvedCanonical = XchatPlanLimits.normalizePlanSlug(raw)
        val isBasicTier = !isGlobalAdminPath && resolvedCanonical == "basic"
        val planTier = if (isGlobalAdminPath) "global_admin" else resolvedCanonical
        return PlanContext(isGlobalAdminPath, resolvedCanonical, isBasicTier, planTier)
    }

    private fun emptyResult(planCtx: PlanContext, generatedAt: String): OptionsActionScanBuildResult =
        OptionsActionScanBuildResult(
            rows = emptyList(),
            planTier = planCtx.planTier,
            truncated = false,
            isBasicTier = planCtx.isBasicTier,
            asMarkdown =
                renderMarkdown(
                    rows = emptyList(),
                    isBasicTier = planCtx.isBasicTier,
                    generatedAtIso = generatedAt,
                ),
            generatedAt = generatedAt,
        )

    private data class MergedPosition(val accountIdHex: String, val row: Map<String, Any?>)

    /**
     * Prefer live Mongo positions (full option legs). Workspace preload rows may omit option fields;
     * those rows are skipped by [normalizeOptionHolding] unless enriched.
     */
    private fun mergePositionsFromDb(
        session: ResolvedSession,
        portfolioId: String,
        accounts: List<Document>,
        positionsRows: List<Map<String, Any?>>,
    ): List<MergedPosition> {
        val fromDb = ArrayList<MergedPosition>()
        for (account in accounts) {
            val accountId = account.getObjectId("_id")?.toHexString() ?: continue
            for (position in positionsService.listPositionsForPortfolioAccount(session, portfolioId, accountId)) {
                fromDb.add(MergedPosition(accountIdHex = accountId, row = documentToPositionRow(position)))
            }
        }
        return if (fromDb.isNotEmpty()) {
            fromDb
        } else {
            positionsRows.map { row ->
                val aid = row["accountId"]?.toString()?.trim().orEmpty()
                MergedPosition(accountIdHex = aid, row = row)
            }
        }
    }

    private fun documentToPositionRow(position: Document): Map<String, Any?> {
        val expIso = expirationIsoFromPosition(position)
        return mapOf(
            "symbol" to (position.getString("symbol") ?: ""),
            "qty" to ((position["qty"] as? Number)?.toDouble() ?: 0.0),
            "avgCost" to ((position["avgCost"] as? Number)?.toDouble() ?: 0.0),
            "accountId" to (position.getObjectId("accountId")?.toHexString() ?: ""),
            "type" to position.getString("type"),
            "optionType" to position.getString("optionType"),
            "strike" to (position["strike"] as? Number)?.toDouble(),
            "expiration" to expIso,
        )
    }

    private fun expirationIsoFromPosition(position: Document): String? {
        val d = position.getDate("expiration")
        if (d != null) {
            return Instant.ofEpochMilli(d.time).atZone(ZoneOffset.UTC).toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE)
        }
        val s = position.getString("expiration")?.trim().orEmpty()
        if (ISO_DATE.matcher(s.take(10)).matches()) {
            return s.take(10)
        }
        return null
    }

    private fun resolvePortfolioId(session: ResolvedSession, portfolioIdHex: String?): String? {
        val explicit = portfolioIdHex?.trim()?.takeIf { ObjectId.isValid(it) }
        if (explicit != null) {
            portfolioCrudService.findPortfolioForSessionUser(explicit, session) ?: return null
            return explicit
        }
        return defaultPortfolioProvisionService.getDefaultPortfolioDoc(session)?.getObjectId("_id")?.toHexString()
    }

    private data class NormalizedOptionHolding(
        val symbol: String,
        val optionType: String,
        val strike: Double,
        val expirationIsoDate: String,
        val qty: Double,
        val avgCost: Double,
    )

    private data class OptionMarketSnapshot(
        val spot: Double?,
        val dte: Int,
        val deltaAbs: Double?,
        val thetaPerDay: Double?,
        val ivPct: Double?,
        val mid: Double?,
        val isInTheMoney: Boolean?,
    )

    private data class ActionParts(
        val recommendedAction: String,
        val why: String,
        val urgency: String,
        val targetWindow: String,
        val confidence: String,
    )

    private data class RowCore(
        val source: String,
        val symbol: String,
        val strike: Double?,
        val exp: String?,
        val type: String?,
        val qty: Double?,
        val portfolioAccountId: String?,
        val portfolioAccountName: String?,
        val recommendedAction: String,
        val why: String,
        val urgency: String,
        val targetWindow: String,
        val confidence: String,
    )

    private fun normalizeOptionHolding(input: Map<String, Any?>): NormalizedOptionHolding? {
        val symbol = (input["symbol"] as? String)?.trim()?.uppercase() ?: return null
        val optionType = (input["optionType"] as? String)?.trim()?.lowercase()
        if (optionType != "call" && optionType != "put") {
            return null
        }
        val strike = (input["strike"] as? Number)?.toDouble() ?: return null
        if (!strike.isFinite() || strike <= 0) {
            return null
        }
        val expRaw = input["expiration"]
        val expirationIsoDate =
            when (expRaw) {
                is String -> expRaw.trim().take(10)
                else -> return null
            }
        if (!ISO_DATE.matcher(expirationIsoDate).matches()) {
            return null
        }
        val qty = (input["qty"] as? Number)?.toDouble() ?: return null
        if (!qty.isFinite() || qty == 0.0) {
            return null
        }
        val avgCost = (input["avgCost"] as? Number)?.toDouble() ?: return null
        if (!avgCost.isFinite() || avgCost < 0) {
            return null
        }
        return NormalizedOptionHolding(symbol, optionType, strike, expirationIsoDate, qty, avgCost)
    }

    private fun daysToExpirationUtc(yyyyMmDd: String): Int {
        val exp =
            runCatching {
                LocalDate.parse(yyyyMmDd, DateTimeFormatter.ISO_LOCAL_DATE)
                    .atStartOfDay(ZoneOffset.UTC)
                    .toInstant()
                    .toEpochMilli()
            }.getOrNull() ?: return Int.MAX_VALUE
        val now = Instant.now()
        val todayUtc =
            now.atZone(ZoneOffset.UTC).toLocalDate()
                .atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        val expUtc =
            LocalDate.parse(yyyyMmDd, DateTimeFormatter.ISO_LOCAL_DATE)
                .atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        val days = ((expUtc - todayUtc) / 86400000L).toInt()
        return max(0, days)
    }

    private fun fetchHoldingMarketSnapshot(
        holding: NormalizedOptionHolding,
        quoteCache: MutableMap<String, Double?>,
    ): OptionMarketSnapshot {
        if (!quoteCache.containsKey(holding.symbol)) {
            val q = yahooClient.fetchUnderlyingQuote(holding.symbol)
            val p = q?.get("regularMarketPrice") as? Double
            quoteCache[holding.symbol] = p?.takeIf { it.isFinite() && it > 0 }
        }
        val spot = quoteCache[holding.symbol]
        val dte = daysToExpirationUtc(holding.expirationIsoDate)
        if (dte == Int.MAX_VALUE) {
            return OptionMarketSnapshot(spot, dte, null, null, null, null, null)
        }
        val expEpoch =
            LocalDate.parse(holding.expirationIsoDate, DateTimeFormatter.ISO_LOCAL_DATE)
                .atStartOfDay(ZoneOffset.UTC)
                .toEpochSecond()
        val root = yahooClient.fetchOptionsJson(holding.symbol, expEpoch) ?: return OptionMarketSnapshot(spot, dte, null, null, null, null, null)
        val contract = findYahooContract(root, holding.expirationIsoDate, holding.strike, holding.optionType == "call")
            ?: return OptionMarketSnapshot(spot, dte, null, null, null, null, nullifyItm(spot, holding))
        val bid = contract.path("bid").asDouble(0.0)
        val ask = contract.path("ask").asDouble(0.0)
        val last = contract.path("lastPrice").asDouble(0.0)
        val premium =
            when {
                last > 0 -> last
                bid > 0 && ask > 0 -> (bid + ask) / 2.0
                else -> max(bid, ask)
            }
        val quoteBid = if (bid > 0) bid else premium
        val quoteAsk = if (ask > 0) ask else premium
        val mid =
            if (quoteBid > 0 && quoteAsk > 0) {
                (quoteBid + quoteAsk) / 2.0
            } else {
                null
            }
        val ivDecimal = contract.path("impliedVolatility").takeIf { !it.isMissingNode && !it.isNull }?.asDouble(0.0)?.takeIf { it > 0 }
        val ivPct = ivDecimal?.times(100.0)
        val deltaAbs =
            if (spot != null && spot > 0) {
                abs(estimateDelta(spot, holding.strike, holding.optionType == "call"))
            } else {
                null
            }
        val thetaPerDay =
            if (spot != null && ivDecimal != null && dte > 0) {
                estimateThetaPerDay(spot, holding.strike, dte, ivDecimal, holding.optionType == "call", mid ?: premium)
            } else {
                null
            }
        val isInTheMoney =
            if (spot != null && spot > 0) {
                if (holding.optionType == "call") {
                    spot >= holding.strike
                } else {
                    spot <= holding.strike
                }
            } else {
                null
            }
        return OptionMarketSnapshot(spot, dte, deltaAbs, thetaPerDay, ivPct, mid, isInTheMoney)
    }

    private fun nullifyItm(spot: Double?, holding: NormalizedOptionHolding): Boolean? {
        val s = spot ?: return null
        return if (holding.optionType == "call") s >= holding.strike else s <= holding.strike
    }

    private fun findYahooContract(root: JsonNode, requestedExpiration: String, targetStrike: Double, wantCall: Boolean): JsonNode? {
        val first = StrategyOptionsYahooClient.firstResult(root) ?: return null
        val optionsArr = first.path("options")
        if (!optionsArr.isArray || optionsArr.size() == 0) {
            return null
        }
        val group = findExpirationGroup(optionsArr, requestedExpiration) ?: return null
        val arr = if (wantCall) group.path("calls") else group.path("puts")
        if (!arr.isArray) {
            return null
        }
        var best: JsonNode? = null
        var bestDiff = Double.MAX_VALUE
        for (n in arr) {
            val strike = n.path("strike").asDouble(0.0)
            if (strike <= 0) {
                continue
            }
            val diff = abs(strike - targetStrike)
            if (diff < bestDiff && diff < 0.01 + 1e-9) {
                bestDiff = diff
                best = n
            }
        }
        return best
    }

    private fun findExpirationGroup(optionsArr: JsonNode, expTarget: String): JsonNode? {
        var best: JsonNode? = null
        var bestDiff = Long.MAX_VALUE
        val targetTime =
            runCatching {
                LocalDate.parse(expTarget, DateTimeFormatter.ISO_LOCAL_DATE)
                    .atStartOfDay(ZoneOffset.UTC)
                    .toInstant()
                    .toEpochMilli()
            }.getOrNull() ?: return null
        for (g in optionsArr) {
            val exp = g.path("expiration").asLong(0L)
            val ds = expirationDateString(exp)
            if (ds == expTarget) {
                return g
            }
            val t = Instant.ofEpochSecond(exp).toEpochMilli()
            val diff = abs(t - targetTime)
            if (diff < bestDiff) {
                bestDiff = diff
                best = g
            }
        }
        return best
    }

    private fun expirationDateString(epochSec: Long): String {
        if (epochSec <= 0L) {
            return ""
        }
        return Instant.ofEpochSecond(epochSec).atZone(ZoneOffset.UTC).toLocalDate()
            .format(DateTimeFormatter.ISO_LOCAL_DATE)
    }

    private fun deriveHoldingAction(
        holding: NormalizedOptionHolding,
        market: OptionMarketSnapshot,
    ): ActionParts {
        val isShort = holding.qty < 0
        val dte = market.dte
        val pnlPct =
            if (market.mid != null && holding.avgCost > 0) {
                if (isShort) {
                    ((holding.avgCost - market.mid) / holding.avgCost) * 100.0
                } else {
                    ((market.mid - holding.avgCost) / holding.avgCost) * 100.0
                }
            } else {
                null
            }
        val targetWindow =
            when {
                dte <= 2 -> "today"
                dte <= 7 -> "this week"
                dte <= 21 -> "next 2-3 weeks"
                else -> "monitor monthly"
            }
        val confidence =
            when {
                market.deltaAbs != null && market.mid != null && market.spot != null -> "high"
                market.spot != null -> "medium"
                else -> "low"
            }

        if (isShort) {
            if (dte <= 3 && market.isInTheMoney == false && (market.mid ?: 1.0) <= 0.1) {
                return ActionParts(
                    recommendedAction = "LET_EXPIRE",
                    why = "Short contract is near expiration and far from assignment risk; remaining premium is minimal.",
                    urgency = "high",
                    targetWindow = targetWindow,
                    confidence = confidence,
                )
            }
            if (dte <= 7 && (market.isInTheMoney == true || (market.deltaAbs ?: 0.0) >= 0.45)) {
                return ActionParts(
                    recommendedAction = "ROLL",
                    why = "Assignment risk is elevated into expiration week; rolling can preserve risk limits and extend time.",
                    urgency = "high",
                    targetWindow = targetWindow,
                    confidence = confidence,
                )
            }
            if (dte <= 10 && pnlPct != null && pnlPct >= 70) {
                return ActionParts(
                    recommendedAction = "BTC",
                    why = "Most premium has likely been captured; buying to close reduces tail risk before expiry.",
                    urgency = "med",
                    targetWindow = targetWindow,
                    confidence = confidence,
                )
            }
            return ActionParts(
                recommendedAction = "HOLD",
                why = "Position is within normal management bounds for DTE and moneyness.",
                urgency = if (dte <= 10) "med" else "low",
                targetWindow = targetWindow,
                confidence = confidence,
            )
        }

        if (dte <= 5 && market.isInTheMoney == false) {
            return ActionParts(
                recommendedAction = "STC",
                why = "Long option is close to expiration and out-of-the-money; time decay risk is now dominant.",
                urgency = "high",
                targetWindow = targetWindow,
                confidence = confidence,
            )
        }
        if (dte <= 10 && (market.thetaPerDay ?: 0.0) < -0.02) {
            return ActionParts(
                recommendedAction = "STC",
                why = "Theta decay is accelerating into expiration; closing preserves remaining value.",
                urgency = "med",
                targetWindow = targetWindow,
                confidence = confidence,
            )
        }
        if (dte <= 14 && market.isInTheMoney == true && pnlPct != null && pnlPct > 40) {
            return ActionParts(
                recommendedAction = "STC",
                why = "Contract is in-the-money with gains and limited time left; realize value before rapid decay.",
                urgency = "med",
                targetWindow = targetWindow,
                confidence = confidence,
            )
        }
        return ActionParts(
            recommendedAction = "HOLD",
            why = "No immediate risk trigger from DTE, moneyness, or decay profile.",
            urgency = if (dte <= 14) "med" else "low",
            targetWindow = targetWindow,
            confidence = confidence,
        )
    }

    private fun deriveWatchlistAction(
        symbol: String,
        entryPrice: Double?,
        spotPrice: Double?,
    ): ActionParts {
        if (entryPrice != null && spotPrice != null) {
            if (spotPrice <= entryPrice * 1.02) {
                return ActionParts(
                    recommendedAction = "OPEN",
                    why = "Spot is near your target entry zone; setup can be reviewed for execution.",
                    urgency = "med",
                    targetWindow = "this week",
                    confidence = "medium",
                )
            }
            return ActionParts(
                recommendedAction = "MONITOR",
                why = "Symbol is above your target entry zone; monitor for better risk/reward before opening.",
                urgency = "low",
                targetWindow = "next 2-3 weeks",
                confidence = "medium",
            )
        }
        if (spotPrice != null) {
            return ActionParts(
                recommendedAction = "MONITOR",
                why = "Live price is available but target entry is not set; keep monitoring until setup criteria are defined.",
                urgency = "low",
                targetWindow = "monthly",
                confidence = "low",
            )
        }
        return ActionParts(
            recommendedAction = "WAIT",
            why = "Insufficient setup data for a trade decision (no target entry or live spot context).",
            urgency = "low",
            targetWindow = "monthly",
            confidence = "low",
        )
    }

    private fun buildReportRowId(
        source: String,
        portfolioAccountId: String?,
        symbol: String,
        exp: String?,
        type: String?,
        recommendedAction: String,
        index: Int,
    ): String {
        val expPart = exp ?: "na"
        val typePart = type ?: "na"
        val book = portfolioAccountId ?: "na"
        return listOf(source, book, symbol, expPart, typePart, recommendedAction, index.toString()).joinToString(":")
    }

    private fun rowCoreToMapPartial(r: RowCore): Map<String, Any?> =
        mapOf(
            "source" to r.source,
            "symbol" to r.symbol,
            "strike" to r.strike,
            "exp" to r.exp,
            "type" to r.type,
            "qty" to r.qty,
            "portfolioAccountId" to r.portfolioAccountId,
            "portfolioAccountName" to r.portfolioAccountName,
            "recommendedAction" to r.recommendedAction,
            "why" to r.why,
            "urgency" to r.urgency,
            "targetWindow" to r.targetWindow,
            "confidence" to r.confidence,
        )

    private fun withApplyRowIds(rows: List<RowCore>): List<Map<String, Any?>> =
        rows.mapIndexed { index, r ->
            val partial = rowCoreToMapPartial(r)
            val rowId =
                buildReportRowId(
                    source = r.source,
                    portfolioAccountId = r.portfolioAccountId,
                    symbol = r.symbol,
                    exp = r.exp,
                    type = r.type,
                    recommendedAction = r.recommendedAction,
                    index = index,
                )
            partial.toMutableMap().apply {
                put("rowId", rowId)
                put(
                    "applyToWatchlist",
                    mapOf(
                        "type" to "apply_to_watchlist",
                        "symbol" to r.symbol,
                        "allowPriceAlert" to true,
                        "defaultPriceAlertSeverity" to "info",
                    ),
                )
            }
        }

    private fun chooseHighestUrgency(rows: List<Map<String, Any?>>): List<Map<String, Any?>> {
        val rank = mapOf("high" to 3, "med" to 2, "low" to 1)
        return rows.sortedWith(
            compareByDescending<Map<String, Any?>> { rank[it["urgency"] as? String] ?: 0 }
                .thenBy { it["symbol"] as? String ?: "" },
        )
    }

    private fun renderMarkdown(
        rows: List<Map<String, Any?>>,
        isBasicTier: Boolean,
        generatedAtIso: String,
    ): String {
        val header =
            if (isBasicTier) {
                "| symbol | strike | exp | type | qty | book | action | target_window | confidence |\n|---|---:|---|---|---:|---|---|---|---|"
            } else {
                "| source | symbol | strike | exp | type | qty | book | action | why | urgency | target_window | confidence |\n|---|---|---:|---|---|---:|---|---|---|---|---|---|"
            }
        val emptyLine =
            if (isBasicTier) {
                "| — | — | — | — | — | — | HOLD | monitor | low |"
            } else {
                "| — | — | — | — | — | — | — | HOLD | — | low | monitor | low |"
            }
        val titleInstant =
            runCatching { Instant.parse(generatedAtIso) }.getOrElse { Instant.now() }
        val z =
            DateTimeFormatter.ofPattern("M/d/yy, h:mm:ss a")
                .withZone(ZoneOffset.UTC)
                .format(titleInstant) + " UTC"
        val title = "### Options action scan ($z)"
        val lines =
            if (rows.isEmpty()) {
                listOf(emptyLine)
            } else {
                rows.map { row ->
                    val sym = row["symbol"] as? String ?: "—"
                    val strikeVal = row["strike"] as? Double
                    val strike = if (strikeVal != null && strikeVal.isFinite()) String.format("%.2f", strikeVal) else "—"
                    val exp = (row["exp"] as? String)?.ifEmpty { "—" } ?: "—"
                    val type = (row["type"] as? String)?.ifEmpty { "—" } ?: "—"
                    val qty = row["qty"]?.let { String.format("%s", it) } ?: "—"
                    val bookRaw =
                        if (row["source"] == "holding") {
                            val name = (row["portfolioAccountName"] as? String)?.trim()
                            val id = row["portfolioAccountId"] as? String
                            name?.takeIf { it.isNotEmpty() } ?: id ?: "—"
                        } else {
                            "—"
                        }
                    val book = markdownTableCell(bookRaw)
                    val action = row["recommendedAction"] as? String ?: "HOLD"
                    val why = markdownTableCell((row["why"] as? String)?.ifEmpty { "—" } ?: "—")
                    val urgency = row["urgency"] as? String ?: "low"
                    val tw = row["targetWindow"] as? String ?: "—"
                    val conf = row["confidence"] as? String ?: "low"
                    if (isBasicTier) {
                        "| $sym | $strike | $exp | $type | $qty | $book | $action | $tw | $conf |"
                    } else {
                        val src = row["source"] as? String ?: "—"
                        "| $src | $sym | $strike | $exp | $type | $qty | $book | $action | $why | $urgency | $tw | $conf |"
                    }
                }
            }
        return (listOf(title, "", header) + lines + listOf("", OPTIONS_SCAN_DISCLAIMER)).joinToString("\n")
    }

    private fun markdownTableCell(value: String): String = value.replace("|", "\\|")

    companion object {
        private val ISO_DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$")
        private const val MAX_BASIC_HOLDINGS_ROWS = 5
        private const val MAX_PRO_REPORT_ROWS = 20
        private const val OPTIONS_SCAN_DISCLAIMER =
            "Not financial advice. This is for informational purposes only. Past performance does not guarantee future results."

        private fun estimateDelta(
            spot: Double,
            strike: Double,
            isCall: Boolean,
        ): Double {
            if (spot <= 0 || strike <= 0) {
                return if (isCall) 0.5 else -0.5
            }
            val moneyness = ((spot - strike) / spot).coerceIn(-0.5, 0.5)
            return if (isCall) {
                (0.5 + moneyness).coerceIn(0.05, 0.95)
            } else {
                (-0.5 + moneyness).coerceIn(-0.95, -0.05)
            }
        }

        /** Rough θ/day (per share) for urgency heuristics when Yahoo omits greeks. */
        private fun estimateThetaPerDay(
            spot: Double,
            strike: Double,
            dte: Int,
            ivDecimal: Double,
            isCall: Boolean,
            mid: Double,
        ): Double {
            if (dte <= 0 || ivDecimal <= 0 || spot <= 0 || strike <= 0 || mid <= 0) {
                return 0.0
            }
            val t = dte / 365.0
            val intrinsic =
                if (isCall) {
                    max(0.0, spot - strike)
                } else {
                    max(0.0, strike - spot)
                }
            val timeValue = max(0.0, mid - intrinsic)
            return -timeValue / max(1.0, dte.toDouble())
        }
    }
}
