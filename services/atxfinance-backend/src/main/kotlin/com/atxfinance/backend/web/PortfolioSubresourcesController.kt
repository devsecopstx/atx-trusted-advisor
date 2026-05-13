package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.BsonJson
import com.atxfinance.backend.portfolio.PortfolioNestedResourceService
import com.atxfinance.backend.portfolio.PortfolioSnapshotService
import com.atxfinance.backend.portfolio.WatchlistDeskScalarPatch
import com.atxfinance.backend.session.SessionCookieParser
import jakarta.servlet.http.HttpServletRequest
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.util.Date

@RestController
class PortfolioSubresourcesController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val nested: PortfolioNestedResourceService,
    private val portfolioSnapshotService: PortfolioSnapshotService,
) {

    @GetMapping("/api/portfolios/{portfolioId}/accounts")
    fun listAccounts(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = requireSession(request) ?: return unauthorized()
        if (!ObjectId.isValid(portfolioId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid portfolio id"))
        }
        val shaped = nested.listAccountsShaped(session, portfolioId)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))
        return ResponseEntity.ok(mapOf("data" to shaped))
    }

    @PostMapping("/api/portfolios/{portfolioId}/accounts")
    fun createAccount(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = requireSession(request) ?: return unauthorized()
        if (!ObjectId.isValid(portfolioId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid portfolio id"))
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        val name = body["name"] as? String
        val trimmedName = name?.trim() ?: ""
        if (trimmedName.isEmpty() || trimmedName.length > 200) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        }
        val type = body["type"] as? String
        val ext = body["extAccountId"] as? String
        val cash = (body["cashBalance"] as? Number)?.toDouble()
        val created = nested.insertAccount(session, portfolioId, trimmedName, type, ext, cash)
            ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Could not create account"))
        portfolioSnapshotService.invalidateWorkspaceSnapshotCache(session, portfolioId)
        val row = accountRow(created, portfolioId, emptyList())
        return ResponseEntity.status(HttpStatus.CREATED).body(mapOf("data" to row))
    }

    @PatchMapping("/api/portfolios/{portfolioId}/accounts/{accountId}")
    fun patchAccount(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @PathVariable accountId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = requireSession(request) ?: return unauthorized()
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        val allowedKeys =
            setOf("name", "cashBalance", "extAccountId", "type", "riskProfile", "outlook", "hnwiGuardrails")
        if (body.keys.none { it in allowedKeys }) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid request payload"))
        }
        return try {
            val updated =
                nested.patchAccount(session, portfolioId, accountId, body)
                    ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Account not found"))
            portfolioSnapshotService.invalidateWorkspaceSnapshotCache(session, portfolioId)
            ResponseEntity.ok(mapOf("data" to BsonJson.documentToMap(updated)))
        } catch (ex: ResponseStatusException) {
            ResponseEntity.status(ex.statusCode).body(mapOf("error" to (ex.reason ?: "Request failed")))
        }
    }

    @DeleteMapping("/api/portfolios/{portfolioId}/accounts/{accountId}")
    fun deleteAccount(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @PathVariable accountId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = requireSession(request) ?: return unauthorized()
        if (!ObjectId.isValid(portfolioId) || !ObjectId.isValid(accountId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid id"))
        }
        val ok = nested.deleteAccount(session, portfolioId, accountId)
        if (!ok) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf(
                    "error" to
                        "Could not delete account. Ensure the account exists and the portfolio has more than one account.",
                ),
            )
        }
        portfolioSnapshotService.invalidateWorkspaceSnapshotCache(session, portfolioId)
        return ResponseEntity.ok(mapOf("ok" to true))
    }

    @GetMapping("/api/portfolios/{portfolioId}/watchlist")
    fun getWatchlist(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = requireSession(request) ?: return unauthorized()
        val quotes = request.getParameter("quotes") == "1"
        val payload = nested.getWatchlistPayload(session, portfolioId, quotes)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Watchlist not found"))
        return ResponseEntity.ok(payload)
    }

    @PatchMapping("/api/portfolios/{portfolioId}/watchlist")
    fun patchWatchlist(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = requireSession(request) ?: return unauthorized()
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        val addSymbols = stringList(body["addSymbols"])?.take(props.maxWatchlistSymbolsPerPatch)
        val removeSymbols = stringList(body["removeSymbols"])?.take(props.maxWatchlistSymbolsPerPatch)
        val addEntries = mapList(body["addEntries"])?.take(props.maxWatchlistSymbolsPerPatch)
        val dedupe = body["dedupe"] as? Boolean
        val name = (body["name"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
        val deskRiskKeys = setOf("conservative", "balanced", "growth")
        val deskOutlookKeys = setOf("bullish", "neutral", "bearish")
        val riskProfile =
            if (body.containsKey("riskProfile")) {
                when (val v = body["riskProfile"]) {
                    null -> WatchlistDeskScalarPatch.Unset
                    is String -> {
                        val s = v.trim().lowercase()
                        if (s.isEmpty()) {
                            WatchlistDeskScalarPatch.Unset
                        } else if (s in deskRiskKeys) {
                            WatchlistDeskScalarPatch.Set(s)
                        } else {
                            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid payload"))
                        }
                    }
                    else -> return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid payload"))
                }
            } else {
                WatchlistDeskScalarPatch.NoChange
            }
        val outlook =
            if (body.containsKey("outlook")) {
                when (val v = body["outlook"]) {
                    null -> WatchlistDeskScalarPatch.Unset
                    is String -> {
                        val s = v.trim().lowercase()
                        if (s.isEmpty()) {
                            WatchlistDeskScalarPatch.Unset
                        } else if (s in deskOutlookKeys) {
                            WatchlistDeskScalarPatch.Set(s)
                        } else {
                            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid payload"))
                        }
                    }
                    else -> return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid payload"))
                }
            } else {
                WatchlistDeskScalarPatch.NoChange
            }
        val hasMutation =
            name != null ||
                !addSymbols.isNullOrEmpty() ||
                !addEntries.isNullOrEmpty() ||
                !removeSymbols.isNullOrEmpty() ||
                dedupe == true ||
                riskProfile != WatchlistDeskScalarPatch.NoChange ||
                outlook != WatchlistDeskScalarPatch.NoChange
        if (!hasMutation) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid payload"))
        }
        val quotes = request.getParameter("quotes") == "1"
        val payload =
            nested.patchWatchlist(
                session,
                portfolioId,
                quotes,
                addSymbols,
                addEntries,
                removeSymbols,
                dedupe,
                name,
                riskProfile,
                outlook,
            )
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Watchlist not found"))
        portfolioSnapshotService.invalidateWorkspaceSnapshotCache(session, portfolioId)
        return ResponseEntity.ok(payload)
    }

    private fun requireSession(request: HttpServletRequest) =
        sessionCookieParser.resolveSessionUser(request.getHeader("Cookie"), props.sessionCookieName)

    private fun unauthorized() =
        ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf<String, Any?>("error" to "Unauthorized"))

    private fun stringList(v: Any?): List<String>? =
        when (v) {
            is List<*> -> v.mapNotNull { (it as? String)?.trim()?.takeIf { s -> s.isNotEmpty() } }
            else -> null
        }

    @Suppress("UNCHECKED_CAST")
    private fun mapList(v: Any?): List<Map<String, Any?>>? =
        when (v) {
            is List<*> -> v.mapNotNull { it as? Map<String, Any?> }
            else -> null
        }

    private fun accountRow(
        account: Document,
        portfolioIdHex: String,
        positions: List<Map<String, Any?>>,
    ): Map<String, Any?> =
        mapOf(
            "_id" to account.getObjectId("_id")?.toHexString(),
            "name" to account.getString("name"),
            "accountRef" to account.getString("extAccountId"),
            "brokerType" to account.getString("type"),
            "balance" to ((account["cashBalance"] as? Number)?.toDouble() ?: 25_000.0),
            "riskLevel" to "medium",
            "strategy" to "balanced",
            "positions" to positions,
            "recommendations" to emptyList<Any>(),
            "userId" to BsonJson.value(account["userId"]),
            "portfolioId" to portfolioIdHex,
            "type" to account.getString("type"),
            "extAccountId" to account.getString("extAccountId"),
            "isDefault" to (account["isDefault"] as? Boolean ?: false),
            "createdAt" to isoField(account["createdAt"]),
            "updatedAt" to isoField(account["updatedAt"]),
        )

    private fun isoField(v: Any?): String =
        when (v) {
            is Date -> v.toInstant().toString()
            is Number -> Date(v.toLong()).toInstant().toString()
            is String -> runCatching { Instant.parse(v).toString() }.getOrElse { Instant.now().toString() }
            else -> Instant.now().toString()
        }
}
