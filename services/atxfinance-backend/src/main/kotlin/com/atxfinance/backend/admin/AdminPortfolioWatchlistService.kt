package com.atxfinance.backend.admin

import com.atxfinance.backend.audit.AuditEventService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import com.atxfinance.backend.portfolio.BsonJson
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.portfolio.WatchlistSymbolCodec
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.Date

/**
 * Global-admin portfolio watchlist (parity with Next
 * `src/app/api/admin/portfolios/[portfolioId]/watchlist/route.ts`).
 */
@Service
class AdminPortfolioWatchlistService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val adminPortfolioAccountsService: AdminPortfolioAccountsService,
    private val auditEventService: AuditEventService,
) {
    private val defaultWatchlistName = "DefaultWatchlist"
    private val defaultSymbol = "TSLA"
    private val riskProfiles = setOf("conservative", "balanced", "growth")
    private val outlookSlugs = setOf("growth", "income", "balanced", "aggressive")
    private val maxPatchEntries = 20

    fun getOrEnsureWatchlistJson(portfolioId: String): Map<String, Any?>? {
        val portfolio = adminPortfolioAccountsService.findPortfolioById(portfolioId) ?: return null
        val pid = portfolio.getObjectId("_id") ?: return null
        val ownerId = portfolioUserIdString(portfolio) ?: return null
        val tenantHex = portfolioTenantIdHex(portfolio)
        var wl = loadWatchlist(ownerId, tenantHex, pid)
        if (wl == null) {
            wl = ensureWatchlistDoc(portfolio, ownerId, tenantHex, pid) ?: return null
        }
        return mapOf("data" to serializeWatchlist(wl))
    }

    fun patchWatchlist(
        session: ResolvedSession,
        portfolioId: String,
        addSymbols: List<String>?,
        addEntries: List<Map<String, Any?>>?,
        removeSymbols: List<String>?,
        dedupe: Boolean?,
        riskProfile: Any?,
        riskProfilePresent: Boolean,
        outlook: Any?,
        outlookPresent: Boolean,
    ): PatchResult {
        if (!ObjectId.isValid(portfolioId)) {
            return PatchResult.BadRequest("Invalid portfolio id")
        }
        if (addSymbols != null && addSymbols.size > maxPatchEntries) {
            return PatchResult.BadRequest("addSymbols exceeds limit")
        }
        if (addEntries != null && addEntries.size > maxPatchEntries) {
            return PatchResult.BadRequest("addEntries exceeds limit")
        }
        if (removeSymbols != null && removeSymbols.size > maxPatchEntries) {
            return PatchResult.BadRequest("removeSymbols exceeds limit")
        }
        val portfolio = adminPortfolioAccountsService.findPortfolioById(portfolioId) ?: return PatchResult.NotFoundPortfolio
        val pid = portfolio.getObjectId("_id") ?: return PatchResult.NotFoundPortfolio
        val ownerId = portfolioUserIdString(portfolio) ?: return PatchResult.NotFoundPortfolio
        val tenantHex = portfolioTenantIdHex(portfolio)

        val hasMutation =
            addSymbols?.isNotEmpty() == true ||
                addEntries?.isNotEmpty() == true ||
                removeSymbols?.isNotEmpty() == true ||
                dedupe == true ||
                riskProfilePresent ||
                outlookPresent
        if (!hasMutation) {
            return PatchResult.BadRequest(
                "Provide addSymbols, addEntries, removeSymbols, dedupe: true, riskProfile, or outlook",
            )
        }

        var wl = loadWatchlist(ownerId, tenantHex, pid)
        if (wl == null) {
            wl = ensureWatchlistDoc(portfolio, ownerId, tenantHex, pid) ?: return PatchResult.NotFoundWatchlist
        }
        val id = wl.getObjectId("_id") ?: return PatchResult.NotFoundWatchlist

        val now = Date()
        var symbols = WatchlistSymbolCodec.normalizeDocumentSymbols(wl["symbols"], emptyList()).toMutableList()

        if (dedupe == true) {
            val seen = LinkedHashMap<String, Document>()
            for (s in symbols) {
                val sym = s.getString("symbol") ?: continue
                if (!seen.containsKey(sym)) {
                    seen[sym] = s
                }
            }
            symbols = seen.values.toMutableList()
        }

        removeSymbols?.takeIf { it.isNotEmpty() }?.let { rem ->
            val removeSet = rem.map { it.trim().uppercase() }.filter { it.isNotEmpty() }.toSet()
            symbols = symbols.filter { s -> !removeSet.contains(s.getString("symbol")) }.toMutableList()
        }

        addSymbols?.takeIf { it.isNotEmpty() }?.let { adds ->
            val existing = symbols.mapNotNull { it.getString("symbol") }.toMutableSet()
            val symRegex = Regex("^[A-Z0-9.\\-]{1,32}$")
            for (raw in adds) {
                val symbol = raw.trim().uppercase()
                if (symbol.isEmpty() || !symRegex.matches(symbol)) {
                    continue
                }
                if (existing.contains(symbol)) {
                    continue
                }
                if (symbols.size >= props.maxWatchlistSymbols) {
                    break
                }
                symbols.add(Document(mapOf("symbol" to symbol, "addedAt" to now)))
                existing.add(symbol)
            }
        }

        addEntries?.takeIf { it.isNotEmpty() }?.let { entries ->
            val symRegex = Regex("^[A-Z0-9.\\-]{1,32}$")
            for (entry in entries) {
                val symbol = (entry["symbol"] as? String)?.trim()?.uppercase() ?: continue
                if (symbol.isEmpty() || !symRegex.matches(symbol)) {
                    continue
                }
                val idx = symbols.indexOfFirst { it.getString("symbol") == symbol }
                if (idx >= 0) {
                    symbols[idx] = WatchlistSymbolCodec.mergeImportEntry(symbols[idx], entry)
                } else {
                    if (symbols.size >= props.maxWatchlistSymbols) {
                        break
                    }
                    val base = Document(mapOf("symbol" to symbol, "addedAt" to now))
                    symbols.add(WatchlistSymbolCodec.mergeImportEntry(base, entry))
                }
            }
        }

        if (symbols.isEmpty()) {
            symbols.add(Document(mapOf("symbol" to defaultSymbol, "addedAt" to now)))
        }

        val update = Update().set("symbols", symbols).set("updatedAt", now)
        if (riskProfilePresent) {
            when (riskProfile) {
                null -> update.unset("riskProfile")
                is String -> {
                    val r = riskProfile.trim().lowercase()
                    if (riskProfiles.contains(r)) {
                        update.set("riskProfile", r)
                    }
                }
            }
        }
        if (outlookPresent) {
            when (outlook) {
                null -> update.unset("outlook")
                is String -> {
                    val o = outlook.trim().lowercase()
                    if (outlookSlugs.contains(o)) {
                        update.set("outlook", o)
                    }
                }
            }
        }

        mongoTemplate.updateFirst(Query.query(Criteria.where("_id").`is`(id)), update, props.watchlistsCollection)
        val reloaded =
            mongoTemplate.findById(id, Document::class.java, props.watchlistsCollection)
                ?: return PatchResult.NotFoundWatchlist
        val entrySymbolsCsv =
            addEntries
                ?.mapNotNull { (it["symbol"] as? String)?.trim()?.uppercase() }
                ?.filter { it.isNotEmpty() }
                ?.let { csvSymbols(it) }
        val details =
            mutableMapOf<String, Any?>(
                "watchlistId" to id.toHexString(),
                "dedupe" to (dedupe == true),
                "riskProfileTouched" to riskProfilePresent,
                "outlookTouched" to outlookPresent,
            )
        csvSymbols(addSymbols)?.let { details["symbolsAddedCsv"] = it }
        csvSymbols(removeSymbols)?.let { details["symbolsRemovedCsv"] = it }
        entrySymbolsCsv?.let { details["addEntriesSymbolsCsv"] = it }
        auditEventService.insertEvent(
            AdminPortfolioAudit.ENTITY_TYPE,
            portfolioId,
            "watchlist_patched",
            session,
            details,
        )
        return PatchResult.Ok(mapOf("data" to serializeWatchlist(reloaded)))
    }

    sealed class PatchResult {
        data class Ok(val body: Map<String, Any?>) : PatchResult()
        data class BadRequest(val message: String) : PatchResult()
        data object NotFoundPortfolio : PatchResult()
        data object NotFoundWatchlist : PatchResult()
    }

    private fun loadWatchlist(ownerId: String, tenantHex: String?, portfolioId: ObjectId): Document? {
        val q = Query.query(
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(ownerId),
                    Criteria.where("portfolioId").`is`(portfolioId),
                ),
                tenantHex,
            ),
        )
        val raw = mongoTemplate.findOne(q, Document::class.java, props.watchlistsCollection) ?: return null
        return normalizeWatchlistDoc(raw)
    }

    private fun normalizeWatchlistDoc(doc: Document): Document {
        val symbols = WatchlistSymbolCodec.normalizeDocumentSymbols(doc["symbols"], listOf(defaultSymbol))
        val copy = Document(doc)
        copy["symbols"] = symbols
        return copy
    }

    private fun ensureWatchlistDoc(
        portfolio: Document,
        ownerId: String,
        tenantHex: String?,
        pid: ObjectId,
    ): Document? {
        val now = Date()
        val tenantOid = tenantHex?.let { PortfolioMongoFilter.tenantObjectId(it) }
        val symbols = WatchlistSymbolCodec.normalizeDocumentSymbols(emptyList<Any?>(), listOf(defaultSymbol))

        val filter =
            PortfolioMongoFilter.strictWriteTenantCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(ownerId),
                    Criteria.where("portfolioId").`is`(pid),
                ),
                tenantHex,
            )
        val upsert =
            Update()
                .setOnInsert("userId", ownerId)
                .setOnInsert("portfolioId", pid)
                .setOnInsert("createdAt", now)
                .set("name", defaultWatchlistName)
                .set("symbols", symbols)
                .set("isDefault", portfolio["isDefault"] as? Boolean == true)
                .set("updatedAt", now)
        tenantOid?.let { upsert.setOnInsert("tenantId", it) }

        mongoTemplate.upsert(Query.query(filter), upsert, props.watchlistsCollection)
        return loadWatchlist(ownerId, tenantHex, pid)
    }

    private fun serializeWatchlist(watchlist: Document): Map<String, Any?> {
        val symbolsRaw = watchlist["symbols"] as? List<*> ?: emptyList<Any?>()
        val symbolRows =
            symbolsRaw.mapNotNull { it as? Document }.map { d ->
                val row = LinkedHashMap<String, Any?>()
                row["symbol"] = d.getString("symbol")
                row["addedAt"] = iso(d["addedAt"])
                d.getString("lineType")?.let { row["lineType"] = it }
                d.getString("strategy")?.let { row["strategy"] = it }
                (d["quantity"] as? Number)?.toDouble()?.let { row["quantity"] = it }
                (d["entryPrice"] as? Number)?.toDouble()?.let { row["entryPrice"] = it }
                row
            }
        val outlookRaw = watchlist.getString("outlook")
        val outlook =
            outlookRaw?.trim()?.lowercase()?.takeIf { outlookSlugs.contains(it) }
        return mapOf(
            "_id" to watchlist.getObjectId("_id")?.toHexString(),
            "userId" to BsonJson.value(watchlist["userId"]),
            "portfolioId" to (watchlist.getObjectId("portfolioId")?.toHexString() ?: ""),
            "name" to (watchlist.getString("name") ?: defaultWatchlistName),
            "isDefault" to (watchlist["isDefault"] as? Boolean ?: false),
            "riskProfile" to watchlist["riskProfile"],
            "outlook" to outlook,
            "symbols" to symbolRows,
            "createdAt" to iso(watchlist["createdAt"]),
            "updatedAt" to iso(watchlist["updatedAt"]),
        )
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
