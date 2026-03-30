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
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.Date

@Service
class PortfolioNestedResourceService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val portfolioCrud: PortfolioCrudService,
    private val provisionService: DefaultPortfolioProvisionService,
) {
    private val accountTypes = setOf("merrill", "fidelity", "etrade", "ibkr")
    private val defaultWatchlistSymbol = "TSLA"

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
            mapOf(
                "_id" to account.getObjectId("_id")?.toHexString(),
                "name" to account.getString("name"),
                "accountRef" to account.getString("extAccountId"),
                "brokerType" to account.getString("type"),
                "balance" to ((account["cashBalance"] as? Number)?.toDouble() ?: 25_000.0),
                "riskLevel" to "medium",
                "strategy" to "balanced",
                "positions" to accountPositions.map { shapePosition(it) },
                "recommendations" to emptyList<Any>(),
                "userId" to BsonJson.value(account["userId"]),
                "portfolioId" to pid.toHexString(),
                "type" to account.getString("type"),
                "extAccountId" to account.getString("extAccountId"),
                "isDefault" to (account["isDefault"] as? Boolean ?: false),
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

    fun patchAccount(
        session: ResolvedSession,
        portfolioId: String,
        accountId: String,
        name: String?,
        cashBalance: Double?,
        extAccountId: String?,
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
        val set = Update().set("updatedAt", Date())
        var changed = false
        if (name != null && name.trim().isNotEmpty()) {
            set.set("name", name.trim())
            changed = true
        }
        if (cashBalance != null && cashBalance.isFinite() && cashBalance >= 0) {
            set.set("cashBalance", cashBalance)
            changed = true
        }
        if (extAccountId != null) {
            val ref = extAccountId.trim()
            if (ref.isNotEmpty()) {
                set.set("extAccountId", ref)
                changed = true
            }
        }
        if (!changed) {
            return existing
        }
        mongoTemplate.updateFirst(Query.query(filter), set, props.accountsCollection)
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
    ): Map<String, Any?>? {
        if (getWatchlistOrProvision(session, portfolioId) == null) {
            return null
        }
        val updated = mutateWatchlistDocument(session, portfolioId, addSymbols, addEntries, removeSymbols, dedupe, name)
            ?: return null
        return buildWatchlistJson(updated, quotes)
    }

    private fun getWatchlistOrProvision(session: ResolvedSession, portfolioId: String): Document? {
        if (!ObjectId.isValid(portfolioId)) {
            return null
        }
        var wl = loadWatchlistRaw(session, portfolioId)
        if (wl != null) {
            return normalizeWatchlistDoc(wl)
        }
        val portfolio = portfolioCrud.findPortfolioForSessionUser(portfolioId, session) ?: return null
        if (portfolio.getObjectId("_id") == null) {
            return null
        }
        runCatching {
            provisionService.provision(session, listOf(defaultWatchlistSymbol))
        }.onFailure {
            return null
        }
        wl = loadWatchlistRaw(session, portfolioId) ?: return null
        return normalizeWatchlistDoc(wl)
    }

    private fun loadWatchlistRaw(session: ResolvedSession, portfolioId: String): Document? {
        val pid = ObjectId(portfolioId)
        val q = Query.query(
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria().andOperator(
                    PortfolioMongoFilter.userIdCriteria(session.userId),
                    Criteria.where("portfolioId").`is`(pid),
                ),
                session.tenantId,
            ),
        )
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
    ): Document? {
        if (!ObjectId.isValid(portfolioId)) {
            return null
        }
        val pid = ObjectId(portfolioId)
        val filter = PortfolioMongoFilter.withTenantScopeCriteria(
            Criteria().andOperator(
                PortfolioMongoFilter.userIdCriteria(session.userId),
                Criteria.where("portfolioId").`is`(pid),
            ),
            session.tenantId,
        )
        val doc = mongoTemplate.findOne(Query.query(filter), Document::class.java, props.watchlistsCollection)
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
