package com.atxfinance.backend.xchat

import com.atxfinance.backend.session.ResolvedSession
import org.springframework.stereotype.Component
import java.time.Instant

data class AtxFunctionOptionsScanResult(
    val markdown: String,
    val donePayload: Map<String, Any?>,
)

data class AtxFunctionWatchlistResult(
    val markdown: String,
    val donePayload: Map<String, Any?>,
)

/**
 * Phase 1 deterministic `atx_function` paths. Phase 2 replaces stubs with Mongo + Yahoo parity from Next.
 */
@Component
class AtxFunctionExecutor {
    fun executeOptionsActionScan(session: ResolvedSession): AtxFunctionOptionsScanResult {
        val generatedAt = Instant.now().toString()
        val rows =
            listOf(
                mapOf(
                    "symbol" to "TSLA",
                    "action" to "MONITOR",
                    "structure" to "Covered call",
                    "note" to "Phase 1 Spring stub — wire holdings + watchlist in Phase 2.",
                ),
            )
        val markdown =
            buildString {
                appendLine("## Options action scan")
                appendLine()
                appendLine("_Phase 1 Spring path for tenant ${session.tenantId} — deterministic stub rows until JVM holdings parity ships._")
                appendLine()
                for (row in rows) {
                    appendLine("- **${row["symbol"]}** — ${row["action"]} (${row["structure"]})")
                }
            }.trimEnd()
        val donePayload =
            mapOf(
                "response" to markdown,
                "model" to "options_action_scan_direct",
                "personaName" to "advisor",
                "contextCount" to 0,
                "contextSource" to "none",
                "collectionSearchStatus" to "skipped_no_collections",
                "optionsActionScan" to
                    mapOf(
                        "generatedAt" to generatedAt,
                        "planTier" to "basic",
                        "truncated" to false,
                        "rows" to rows,
                        "disclaimer" to "Not financial advice.",
                    ),
                "toolCalls" to listOf(mapOf("name" to "atx_function", "durationMs" to 0)),
                "interactionMeta" to
                    mapOf(
                        "generationMs" to 0,
                        "sources" to
                            mapOf(
                                "ragChunks" to 0,
                                "toolInvocations" to 1,
                                "personaCollections" to 0,
                                "total" to 1,
                            ),
                    ),
            )
        return AtxFunctionOptionsScanResult(
            markdown = markdown,
            donePayload = donePayload,
        )
    }

    fun executeWatchlistSnapshot(session: ResolvedSession): AtxFunctionWatchlistResult {
        val symbols = listOf("TSLA", "RKLB")
        val markdown =
            buildString {
                appendLine("## Watchlist")
                appendLine()
                appendLine("_Phase 1 Spring path — stub symbols until JVM watchlist parity ships._")
                appendLine()
                for (symbol in symbols) {
                    appendLine("- $symbol")
                }
            }.trimEnd()
        val donePayload =
            mapOf(
                "response" to markdown,
                "model" to "watchlist_snapshot_direct",
                "personaName" to "advisor",
                "contextCount" to 0,
                "contextSource" to "none",
                "toolCalls" to listOf(mapOf("name" to "atx_function", "durationMs" to 0)),
                "interactionMeta" to
                    mapOf(
                        "generationMs" to 0,
                        "sources" to
                            mapOf(
                                "ragChunks" to 0,
                                "toolInvocations" to 1,
                                "personaCollections" to 0,
                                "total" to 1,
                            ),
                    ),
            )
        return AtxFunctionWatchlistResult(
            markdown = markdown,
            donePayload = donePayload,
        )
    }
}
