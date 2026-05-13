package com.atxfinance.backend.portfolio

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.util.Date

/** Desk field patch for app-user watchlist documents (`riskProfile`, `outlook`). */
sealed interface WatchlistDeskScalarPatch {
    data object NoChange : WatchlistDeskScalarPatch

    data object Unset : WatchlistDeskScalarPatch

    data class Set(val value: String) : WatchlistDeskScalarPatch
}

@Service
class PortfolioNestedResourceService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val portfolioCrud: PortfolioCrudService,
    private val provisionService: DefaultPortfolioProvisionService,
) {
    private val accountTypes = setOf("merrill", "fidelity", "etrade", "ibkr", "schwab", "other")
    private val deskRiskProfiles = setOf("conservative", "balanced", "growth")
    private val deskOutlookCanonical = setOf("bullish", "neutral", "bearish")
    private val deskOutlookAliases =
        mapOf(
            "growth" to "bullish",
            "aggressive" to "bullish",
            "balanced" to "neutral",
            "income" to "bearish",
            "up" to "bullish",
            "down" to "bearish",
            "flat" to "neutral",
        )
    private val defaultWatchlistSymbol = "TSLA"

    private val hnwiGuardrailKeys =
        setOf(
            "taxTreatment",
            "maxPositionPctOfEquity",
            "marginRule",
            "taxLotMatching",
            "minLiquidityCashPctOfEquity",
            "minLiquidityMonthsExpenses",
        )

    private fun coerceHnwiGuardrailField(
        key: String,
        value: Any?,
    ): Any? {
        when (key) {
            "taxTreatment" -> {
                val s =
                    (value as? String)?.trim()?.lowercase()
                        ?: throw ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Invalid hnwiGuardrails.taxTreatment",
                        )
                if (s != "taxable" && s != "tax_advantaged") {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid hnwiGuardrails.taxTreatment")
                }
                return s
            }
            "maxPositionPctOfEquity" -> {
                val d =
                    (value as? Number)?.toDouble()
                        ?: throw ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Invalid hnwiGuardrails.maxPositionPctOfEquity",
                        )
                if (!d.isFinite() || d < 0.01 || d > 1.0) {
                    throw ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Invalid hnwiGuardrails.maxPositionPctOfEquity",
                    )
                }
                return d
            }
            "marginRule" -> {
                val s =
                    (value as? String)?.trim()?.lowercase()
                        ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid hnwiGuardrails.marginRule")
                if (s != "cash_only" && s != "limited_margin" && s != "full_margin") {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid hnwiGuardrails.marginRule")
                }
                return s
            }
            "taxLotMatching" -> {
                val s =
                    (value as? String)?.trim()?.lowercase()
                        ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid hnwiGuardrails.taxLotMatching")
                if (s != "fifo" && s != "lifo" && s != "specific_identification" && s != "highest_cost") {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid hnwiGuardrails.taxLotMatching")
                }
                return s
            }
            "minLiquidityCashPctOfEquity" -> {
                val d =
                    (value as? Number)?.toDouble()
                        ?: throw ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Invalid hnwiGuardrails.minLiquidityCashPctOfEquity",
                        )
                if (!d.isFinite() || d < 0 || d > 1.0) {
                    throw ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Invalid hnwiGuardrails.minLiquidityCashPctOfEquity",
                    )
                }
                return d
            }
            "minLiquidityMonthsExpenses" -> {
                val d =
                    (value as? Number)?.toDouble()
                        ?: throw ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Invalid hnwiGuardrails.minLiquidityMonthsExpenses",
                        )
                if (!d.isFinite() || d < 0 || d > 600) {
                    throw ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Invalid hnwiGuardrails.minLiquidityMonthsExpenses",
                    )
                }
                return d
            }
            else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown hnwiGuardrails key")
        }
    }

    private fun mergeHnwiGuardrails(
        existing: Document?,
        patch: Map<String, Any?>,
    ): Document? {
        val out = Document(existing ?: Document())
        for ((k, v) in patch) {
            if (k !in hnwiGuardrailKeys) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown hnwiGuardrails key")
            }
            if (v == null) {
                out.remove(k)
            } else {
                out[k] = coerceHnwiGuardrailField(k, v)
            }
        }
        return if (out.isEmpty()) null else out
    }

    private fun normalizeDeskOutlook(raw: String): String? {
        val t = raw.trim().lowercase()
        if (t in deskOutlookCanonical) {
            return t
        }
        return deskOutlookAliases[t]
    }

    private fun riskLevelFromProfile(profile: String?): String =
        when (profile) {
            "conservative" -> "low"
            "growth" -> "high"
            else -> "medium"
        }

    private fun strategyFromOutlook(outlook: String?): String =
        when (outlook) {
            "bullish" -> "aggressive"
            "bearish" -> "income"
            else -> "balanced"
        }

    fun listAccountsShaped(session: ResolvedSession, portfolioId: String): List<Map<String, Any?>>? {
        if (!ObjectId.isValid(portfolioId)) {
            return null
        }
        val portfolio = portfolioCrud.findPortfolioForSessionUser(portfolioId, session) ?: return null
        val pid = portfolio.getObjectId("_id")!!
        var accounts = portfolioCrud.listAccountsForPortfolio(pid, session)
        if (accounts.isEmpty()) {
            provisionService.provision(session, listOf(defaultWatchlistSymbol))
            accounts = portfolioCrud.listAccountsForPortfolio(pid, session)
        }
        val accountIds = accounts.mapNotNull { it.getObjectId("_id") }
        val positions = listPositions(session, pid, accountIds)
        val byAccount = positions.groupBy { it.getObjectId("accountId")?.toHexString() ?: "" }
        return accounts.map { account ->
            val accountId = account.getObjectId("_id")?.toHexString() ?: ""
            val accountPositions = byAccount[accountId].orEmpty()
            val riskProfile = account.getString("riskProfile")
            val outlookRaw = account.getString("outlook")
            val outlookCanon =
                outlookRaw?.let { raw ->
                    normalizeDeskOutlook(raw) ?: raw.trim().lowercase().takeIf { it in deskOutlookCanonical }
                }
            mapOf(
                "_id" to account.getObjectId("_id")?.toHexString(),
                "name" to account.getString("name"),
                "accountRef" to account.getString("extAccountId"),
                "brokerType" to account.getString("type"),
                "balance" to ((account["cashBalance"] as? Number)?.toDouble() ?: 25_000.0),
                "riskLevel" to riskLevelFromProfile(riskProfile),
                "strategy" to strategyFromOutlook(outlookCanon),
                "riskProfile" to riskProfile,
                "outlook" to outlookCanon,
                "brokerImportLocked" to (account["brokerImportLocked"] as? Boolean ?: false),
                "positions" to accountPositions.map { shapePosition(it) },
                "recommendations" to emptyList<Any>(),
                "userId" to BsonJson.value(account["userId"]),
                "portfolioId" to pid.toHexString(),
                "type" to account.getString("type"),
                "extAccountId" to account.getString("extAccountId"),
                "isDefault" to (account["isDefault"] as? Boolean ?: false),
                "hnwiGuardrails" to ((account["hnwiGuardrails"] as? Document)?.let { BsonJson.documentToMap(it) }),
                "createdAt" to iso(account["createdAt"]),
                "updatedAt" to iso(account["updatedAt"]),
            )
        }
    }

    fun insertAccount(
        session: ResolvedSession,
        portfolioId: String,
        name: String,
        type: String?,
        extAccountId: String?,
        cashBalance: Double?,
    ): Document? {
        if (!ObjectId.isValid(portfolioId)) {
            return null
        }
        val portfolio = portfolioCrud.findPortfolioForSessionUser(portfolioId, session) ?: return null
        val pid = portfolio.getObjectId("_id")!!
        val trimmedName = name.trim().take(200)
        if (trimmedName.isEmpty()) {
            return null
        }
        val accType = type?.trim()?.lowercase()?.takeIf { accountTypes.contains(it) } ?: "fidelity"
        val ext = extAccountId?.trim()?.take(200)?.takeIf { it.isNotEmpty() }
            ?: "atx-${ObjectId().toHexString().takeLast(12)}"
        val cash = cashBalance?.takeIf { it.isFinite() && it >= 0 } ?: props.defaultAccountCashBalance
        val now = Date()
        val tenantOid = PortfolioMongoFilter.tenantObjectId(session.tenantId)
        val doc = Document(
            mapOf(
                "userId" to session.userId,
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
        tenantOid?.let { doc["tenantId"] = it }
        mongoTemplate.insert(doc, props.accountsCollection)
        val id = doc.getObjectId("_id") ?: return null
        return mongoTemplate.findById(id, Document::class.java, props.accountsCollection)
    }

    @Suppress("UNCHECKED_CAST")
    fun patchAccount(
        session: ResolvedSession,
        portfolioId: String,
        accountId: String,
        body: Map<String, Any?>,
    ): Document? {
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(accountId)) {
            return null
        }
        val pid = ObjectId(portfolioId)
        val aid = ObjectId(accountId)
        val filter = PortfolioMongoFilter.withTenantScopeCriteria(
            Criteria().andOperator(
                Criteria.where("_id").`is`(aid),
                PortfolioMongoFilter.userIdCriteria(session.userId),
                Criteria.where("portfolioId").`is`(pid),
            ),
            session.tenantId,
        )
        val existing = mongoTemplate.findOne(Query.query(filter), Document::class.java, props.accountsCollection)
            ?: return null

        val brokerLocked = existing["brokerImportLocked"] as? Boolean == true
        if (brokerLocked && body.containsKey("type")) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "Broker type is locked after a CSV import. Account ref can still be updated.",
            )
        }

        val upd = Update().set("updatedAt", Date())
        var changed = false

        if (body.containsKey("name")) {
            val n = (body["name"] as? String)?.trim()
            if (n.isNullOrEmpty() || n.length > 80) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid name")
            }
            upd.set("name", n)
            changed = true
        }

        if (body.containsKey("cashBalance")) {
            val raw = body["cashBalance"]
            val d =
                when (raw) {
                    is Number -> raw.toDouble()
                    else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid cashBalance")
                }
            if (!d.isFinite() || d < 0) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid cashBalance")
            }
            upd.set("cashBalance", d)
            changed = true
        }

        if (body.containsKey("extAccountId")) {
            val ref = (body["extAccountId"] as? String)?.trim() ?: ""
            if (ref.isNotEmpty()) {
                upd.set("extAccountId", ref.take(200))
                changed = true
            }
        }

        if (body.containsKey("type") && !brokerLocked) {
            val rawType = body["type"]
            if (rawType == null) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid type")
            }
            val t = (rawType as? String)?.trim()?.lowercase()
            if (t == null || t !in accountTypes) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid type")
            }
            upd.set("type", t)
            changed = true
        }

        if (body.containsKey("riskProfile")) {
            changed = true
            when (val v = body["riskProfile"]) {
                null -> {
                    upd.unset("riskProfile")
                }
                is String -> {
                    val r = v.trim().lowercase()
                    if (r !in deskRiskProfiles) {
                        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid riskProfile")
                    }
                    upd.set("riskProfile", r)
                }
                else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid riskProfile")
            }
        }

        if (body.containsKey("outlook")) {
            changed = true
            when (val v = body["outlook"]) {
                null -> {
                    upd.unset("outlook")
                }
                is String -> {
                    val canon = normalizeDeskOutlook(v)
                    if (canon == null) {
                        throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid outlook")
                    }
                    upd.set("outlook", canon)
                }
                else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid outlook")
            }
        }

        if (body.containsKey("hnwiGuardrails")) {
            changed = true
            when (val raw = body["hnwiGuardrails"]) {
                null -> {
                    upd.unset("hnwiGuardrails")
                }
                is Map<*, *> -> {
                    @Suppress("UNCHECKED_CAST")
                    val patchMap = raw as Map<String, Any?>
                    val existingDoc = existing["hnwiGuardrails"] as? Document
                    val merged = mergeHnwiGuardrails(existingDoc, patchMap)
                    if (merged == null || merged.isEmpty()) {
                        upd.unset("hnwiGuardrails")
                    } else {
                        upd.set("hnwiGuardrails", merged)
                    }
                }
                else -> throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid hnwiGuardrails")
            }
        }

        if (!changed) {
            return existing
        }
        mongoTemplate.updateFirst(Query.query(filter), upd, props.accountsCollection)
        return mongoTemplate.findOne(Query.query(filter), Document::class.java, props.accountsCollection)
    }

    fun deleteAccount(session: ResolvedSession, portfolioId: String, accountId: String): Boolean {
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(accountId)) {
            return false
        }
        val portfolio = portfolioCrud.findPortfolioForSessionUser(portfolioId, session) ?: return false
        val pid = portfolio.getObjectId("_id") ?: return false
        val aid = ObjectId(accountId)
        val accounts = portfolioCrud.listAccountsForPortfolio(pid, session)
        if (accounts.size <= 1) {
            return false
        }
        val target = accounts.firstOrNull { it.getObjectId("_id") == aid } ?: return false
        val wasDefault = target["isDefault"] as? Boolean ?: false

        val posFilter =
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(session.userId),
                    Criteria.where("portfolioId").`is`(pid),
                    Criteria.where("accountId").`is`(aid),
                ),
                session.tenantId,
            )
        mongoTemplate.remove(Query.query(posFilter), props.positionsCollection)

        val accBase =
            Criteria().andOperator(
                Criteria.where("_id").`is`(aid),
                PortfolioMongoFilter.userIdCriteria(session.userId),
                Criteria.where("portfolioId").`is`(pid),
            )
        val accFilter = PortfolioMongoFilter.strictWriteTenantCriteria(accBase, session.tenantId)
        val removed = mongoTemplate.remove(Query.query(accFilter), props.accountsCollection)
        if (removed.deletedCount != 1L) {
            return false
        }
        if (wasDefault) {
            val next = accounts.firstOrNull { it.getObjectId("_id") != aid }
            val nextId = next?.getObjectId("_id") ?: return true
            val promoteBase =
                Criteria().andOperator(
                    Criteria.where("_id").`is`(nextId),
                    PortfolioMongoFilter.userIdCriteria(session.userId),
                    Criteria.where("portfolioId").`is`(pid),
                )
            val promoteFilter = PortfolioMongoFilter.strictWriteTenantCriteria(promoteBase, session.tenantId)
            mongoTemplate.updateFirst(
                Query.query(promoteFilter),
                Update().set("isDefault", true).set("updatedAt", Date()),
                props.accountsCollection,
            )
        }
        return true
    }

    fun getWatchlistPayload(session: ResolvedSession, portfolioId: String, quotes: Boolean): Map<String, Any?>? {
        val wl = getWatchlistOrProvision(session, portfolioId) ?: return null
        return buildWatchlistJson(wl, quotes)
    }

    fun patchWatchlist(
        session: ResolvedSession,
        portfolioId: String,
        quotes: Boolean,
        addSymbols: List<String>?,
        addEntries: List<Map<String, Any?>>?,
        removeSymbols: List<String>?,
        dedupe: Boolean?,
        name: String?,
        riskProfile: WatchlistDeskScalarPatch = WatchlistDeskScalarPatch.NoChange,
        outlook: WatchlistDeskScalarPatch = WatchlistDeskScalarPatch.NoChange,
    ): Map<String, Any?>? {
        if (getWatchlistOrProvision(session, portfolioId) == null) {
            return null
        }
        val updated =
            mutateWatchlistDocument(
                session,
                portfolioId,
                addSymbols,
                addEntries,
                removeSymbols,
                dedupe,
                name,
                riskProfile,
                outlook,
            )
            ?: return null
        return buildWatchlistJson(updated, quotes)
    }

    private fun getWatchlistOrProvision(session: ResolvedSession, portfolioId: String): Document? {
        if (!ObjectId.isValid(portfolioId)) {
            return null
        }
        val portfolio = portfolioCrud.findPortfolioForSessionUser(portfolioId, session) ?: return null
        if (portfolio.getObjectId("_id") == null) {
            return null
        }
        var wl = loadWatchlistRaw(session)
        if (wl != null) {
            return normalizeWatchlistDoc(wl)
        }
        runCatching {
            provisionService.provision(session, listOf(defaultWatchlistSymbol))
        }.onFailure {
            return null
        }
        wl = loadWatchlistRaw(session) ?: return null
        return normalizeWatchlistDoc(wl)
    }

    private fun loadWatchlistRaw(session: ResolvedSession): Document? {
        val q = Query.query(PortfolioMongoFilter.watchlistSessionReadCriteria(session))
        return mongoTemplate.findOne(q, Document::class.java, props.watchlistsCollection)
    }

    private fun normalizeWatchlistDoc(doc: Document): Document {
        val symbols = WatchlistSymbolCodec.normalizeDocumentSymbols(doc["symbols"], listOf(defaultWatchlistSymbol))
        val copy = Document(doc)
        copy["symbols"] = symbols
        return copy
    }

    private fun mutateWatchlistDocument(
        session: ResolvedSession,
        portfolioId: String,
        addSymbols: List<String>?,
        addEntries: List<Map<String, Any?>>?,
        removeSymbols: List<String>?,
        dedupe: Boolean?,
        newName: String?,
        riskProfile: WatchlistDeskScalarPatch = WatchlistDeskScalarPatch.NoChange,
        outlook: WatchlistDeskScalarPatch = WatchlistDeskScalarPatch.NoChange,
    ): Document? {
        if (!ObjectId.isValid(portfolioId)) {
            return null
        }
        if (portfolioCrud.findPortfolioForSessionUser(portfolioId, session) == null) {
            return null
        }
        val doc =
            mongoTemplate.findOne(
                Query.query(PortfolioMongoFilter.watchlistSessionReadCriteria(session)),
                Document::class.java,
                props.watchlistsCollection,
            )
                ?: return null
        val now = Date()
        var symbols = WatchlistSymbolCodec.normalizeDocumentSymbols(doc["symbols"], emptyList())
            .toMutableList()

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
            symbols.add(Document(mapOf("symbol" to defaultWatchlistSymbol, "addedAt" to now)))
        }

        val update = Update().set("symbols", symbols).set("updatedAt", now)
        newName?.trim()?.takeIf { it.isNotEmpty() }?.let {
            update.set("name", it.take(128))
        }
        when (riskProfile) {
            is WatchlistDeskScalarPatch.Set ->
                if (riskProfile.value in deskRiskProfiles) {
                    update.set("riskProfile", riskProfile.value)
                }
            WatchlistDeskScalarPatch.Unset -> update.unset("riskProfile")
            WatchlistDeskScalarPatch.NoChange -> Unit
        }
        when (outlook) {
            is WatchlistDeskScalarPatch.Set -> {
                val canon = deskOutlookAliases[outlook.value] ?: outlook.value
                if (canon in deskOutlookCanonical) {
                    update.set("outlook", canon)
                }
            }
            WatchlistDeskScalarPatch.Unset -> update.unset("outlook")
            WatchlistDeskScalarPatch.NoChange -> Unit
        }
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(doc.getObjectId("_id"))),
            update,
            props.watchlistsCollection,
        )
        val reloaded = mongoTemplate.findById(doc.getObjectId("_id"), Document::class.java, props.watchlistsCollection)
            ?: return null
        return normalizeWatchlistDoc(reloaded)
    }

    private fun buildWatchlistJson(watchlist: Document, quotes: Boolean): Map<String, Any?> {
        val symbolsDocs = watchlist["symbols"] as? List<*> ?: emptyList<Any?>()
        val docList = symbolsDocs.mapNotNull { it as? Document }
        val symbols = docList.map { symbolRowToJson(it) }
        val data = LinkedHashMap<String, Any?>()
        for (key in watchlist.keys) {
            if (key == "symbols") {
                continue
            }
            data[key] = BsonJson.value(watchlist[key])
        }
        data["symbols"] = symbols
        data["symbolsDetailed"] = symbols
        if (quotes) {
            data["symbolsWithQuotes"] = symbols.map { row ->
                LinkedHashMap<String, Any?>(row).apply { put("quote", null) }
            }
        }
        return mapOf(
            "data" to data,
            "metadata" to mapOf(
                "lookupRoute" to "yahoo-finance2",
                // JVM backend does not run yahoo-finance2 yet; omit live quotes even when ?quotes=1
                "symbolLookupEnabled" to false,
            ),
        )
    }

    private fun symbolRowToJson(d: Document): Map<String, Any?> {
        val m = LinkedHashMap<String, Any?>()
        m["symbol"] = d.getString("symbol")
        m["addedAt"] = iso(d["addedAt"])
        d.getString("lineType")?.let { m["lineType"] = it }
        d.getString("strategy")?.let { m["strategy"] = it }
        (d["quantity"] as? Number)?.toDouble()?.let { m["quantity"] = it }
        (d["entryPrice"] as? Number)?.toDouble()?.let { m["entryPrice"] = it }
        d.getString("rationale")?.let { m["rationale"] = it }
        d.getString("rowStatus")?.let { m["rowStatus"] = it }
        (d["priceAlertMinAbsMovePercent"] as? Number)?.toDouble()?.let { m["priceAlertMinAbsMovePercent"] = it }
        return m
    }

    private fun listPositions(session: ResolvedSession, portfolioId: ObjectId, accountIds: List<ObjectId>): List<Document> {
        if (accountIds.isEmpty()) {
            return emptyList()
        }
        val q = Query.query(
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(session.userId),
                    Criteria.where("portfolioId").`is`(portfolioId),
                    Criteria.where("accountId").`in`(accountIds),
                ),
                session.tenantId,
            ),
        )
        q.with(Sort.by(Sort.Direction.ASC, "createdAt"))
        return mongoTemplate.find(q, Document::class.java, props.positionsCollection)
    }

    private fun shapePosition(position: Document): Map<String, Any?> {
        val qty = (position["qty"] as? Number)?.toDouble() ?: 0.0
        val avg = (position["avgCost"] as? Number)?.toDouble() ?: 0.0
        return mapOf(
            "_id" to position.getObjectId("_id")?.toHexString(),
            "type" to "stock",
            "ticker" to (position.getString("symbol") ?: ""),
            "shares" to qty,
            "purchasePrice" to avg,
            "currentPrice" to avg,
        )
    }

    private fun iso(v: Any?): String =
        when (v) {
            is Date -> v.toInstant().toString()
            is Number -> Date(v.toLong()).toInstant().toString()
            is String -> runCatching { Instant.parse(v).toString() }.getOrElse { Instant.now().toString() }
            else -> Instant.now().toString()
        }
}
