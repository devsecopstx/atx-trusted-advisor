package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.BrokerHoldingsImportService
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.isGlobalAdmin
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class AdminImportBrokerController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val brokerImportService: BrokerHoldingsImportService,
) {

    @PostMapping("/api/admin/import/broker")
    fun post(
        request: HttpServletRequest,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> g.session
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }

        val portfolioId = (body["portfolioId"] as? String)?.trim()
            ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "portfolioId is required"))
        val broker = (body["broker"] as? String)?.trim()?.lowercase()
            ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "broker is required"))
        if (broker !in listOf("merrill", "fidelity")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "broker must be merrill or fidelity"))
        }
        val exportType = (body["exportType"] as? String)?.trim()?.lowercase() ?: "holdings"
        if (exportType != "holdings") {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "exportType must be holdings"))
        }
        val csv = (body["csv"] as? String)?.trim()
            ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "csv is required"))
        val rawMappings = body["mappings"]
        val mappings = when (rawMappings) {
            is Map<*, *> -> rawMappings.mapNotNull { (k, v) ->
                val key = (k as? String)?.trim()?.takeIf { it.isNotEmpty() }
                val value = (v as? String)?.trim()?.takeIf { it.isNotEmpty() }
                if (key != null && value != null) key to value else null
            }.toMap()
            else -> emptyMap()
        }
        val fidelityRef = (body["fidelityHoldingsDefaultAccountRef"] as? String)?.trim().orEmpty()
        val dryRun = body["dryRun"] as? Boolean ?: false

        val (parsedAccounts, parseError) = brokerImportService.parseAndPreview(broker, csv, fidelityRef)
        if (parseError != null || parsedAccounts.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to (parseError ?: "No accounts parsed from CSV")))
        }

        if (dryRun) {
            val preview = parsedAccounts.map { acc ->
                val stockCount = acc.positions.count { it.type == "stock" }
                val optionCount = acc.positions.count { it.type == "option" }
                val cashCount = acc.positions.count { it.type == "cash" }
                mapOf(
                    "accountRef" to acc.accountRef,
                    "label" to acc.label,
                    "positionCount" to acc.positions.size,
                    "stockCount" to stockCount,
                    "optionCount" to optionCount,
                    "cashCount" to cashCount,
                    "sampleTickers" to acc.positions.filter { it.type == "stock" }.map { it.ticker }.distinct().take(8),
                )
            }
            return ResponseEntity.ok(mapOf("dryRun" to true, "broker" to broker, "exportType" to exportType, "accounts" to preview))
        }

        return try {
            val results = brokerImportService.apply(session, portfolioId, parsedAccounts, mappings)
            ResponseEntity.ok(mapOf("results" to results.map { r ->
                mapOf(
                    "accountRef" to r.accountRef,
                    "label" to r.label,
                    "imported" to r.imported,
                    "skippedNonStock" to r.skippedNonStock,
                    "deletedPrior" to r.deletedPrior,
                    "error" to r.error,
                )
            }))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to (e.message ?: "Portfolio not found")))
        }
    }

    private sealed class AdminGate {
        data class Ok(val session: com.atxfinance.backend.session.ResolvedSession) : AdminGate()
        data class Err(val response: ResponseEntity<Map<String, Any?>>) : AdminGate()
    }

    private fun adminGate(request: HttpServletRequest): AdminGate {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return AdminGate.Err(
            ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized")),
        )
        if (!session.isGlobalAdmin()) {
            return AdminGate.Err(
                ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden")),
            )
        }
        return AdminGate.Ok(session)
    }
}
