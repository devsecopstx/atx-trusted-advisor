package com.atxfinance.backend.xchat

import org.bson.Document

object XchatPersonaSupport {
    fun systemPrompt(persona: Document?): String {
        val base = persona?.getString("systemPrompt")?.trim().orEmpty()
        if (base.isNotEmpty()) {
            return base
        }
        return "You are xFinance workspace assistant. Use atx_function for portfolio, watchlist, and positions facts."
    }

    fun model(persona: Document?, fallback: String): String =
        persona?.getString("model")?.trim()?.takeIf { it.isNotEmpty() } ?: fallback

    fun maxTurns(persona: Document?): Int {
        val xapi = persona?.get("xapi", Document::class.java) ?: return 5
        val raw = (xapi["maxTurns"] as? Number)?.toInt() ?: 5
        return raw.coerceIn(1, 10)
    }

    fun toolChoice(persona: Document?): String =
        persona?.get("xapi", Document::class.java)?.getString("toolChoice")?.trim()?.takeIf { it.isNotEmpty() }
            ?: "auto"

    fun wireTools(persona: Document?): List<Map<String, Any?>> {
        val xapi = persona?.get("xapi", Document::class.java)
        val tools = xapi?.get("tools") as? List<*> ?: emptyList<Any>()
        val out = mutableListOf<Map<String, Any?>>()
        for (tool in tools) {
            if (tool is Document) {
                out.add(documentToMap(tool))
            }
        }
        if (out.none { it["name"] == "atx_function" || (it["function"] as? Map<*, *>)?.get("name") == "atx_function" }) {
            out.add(defaultAtxFunctionTool())
        }
        return out.take(32)
    }

    fun linkedCollectionIds(persona: Document?): List<String> {
        if (persona == null) {
            return emptyList()
        }
        val ids = mutableListOf<String>()
        (persona.get("xaiCollection", Document::class.java))?.getString("collectionId")?.trim()?.takeIf { it.isNotEmpty() }?.let(ids::add)
        (persona.get("teamCollection", Document::class.java))?.getString("collectionId")?.trim()?.takeIf { it.isNotEmpty() }?.let(ids::add)
        val tools = persona.get("xapi", Document::class.java)?.get("tools") as? List<*> ?: emptyList<Any>()
        for (tool in tools) {
            val td = tool as? Document ?: continue
            when (td.getString("type")) {
                "collections_search" -> {
                    (td["collection_ids"] as? List<*>)?.forEach { id ->
                        if (id is String && id.trim().isNotEmpty()) {
                            ids.add(id.trim())
                        }
                    }
                }
                "file_search" -> {
                    val source = td.get("source", Document::class.java)
                    (source?.get("collection_ids") as? List<*>)?.forEach { id ->
                        if (id is String && id.trim().isNotEmpty()) {
                            ids.add(id.trim())
                        }
                    }
                }
            }
        }
        return ids.distinct()
    }

    fun defaultAtxFunctionTool(): Map<String, Any?> =
        mapOf(
            "type" to "function",
            "name" to "atx_function",
            "description" to
                "Workspace portfolio, watchlist, positions, options scan, and Premium+ NL price alerts (price_alert_manage).",
            "parameters" to
                mapOf(
                    "type" to "object",
                    "properties" to
                        mapOf(
                            "operation" to
                                mapOf(
                                    "type" to "string",
                                    "description" to
                                        "portfolio_summary | watchlist_snapshot | positions_snapshot | options_action_scan | price_alert_manage",
                                ),
                            "priceAlertOp" to
                                mapOf(
                                    "type" to "string",
                                    "enum" to listOf("list", "add", "remove_symbol", "clear_all"),
                                    "description" to "Required when operation is price_alert_manage.",
                                ),
                            "symbol" to
                                mapOf(
                                    "type" to "string",
                                    "description" to "Ticker for price_alert_manage add/remove_symbol.",
                                ),
                            "symbols" to
                                mapOf(
                                    "type" to "array",
                                    "items" to mapOf("type" to "string"),
                                    "description" to "Optional ticker list (first symbol used for NL add/remove).",
                                ),
                            "targetPrice" to
                                mapOf(
                                    "type" to "number",
                                    "description" to "USD threshold for price_alert_manage add (aliases: price, level).",
                                ),
                            "ruleKind" to
                                mapOf(
                                    "type" to "string",
                                    "enum" to listOf("above", "below", "crosses"),
                                    "description" to "Required for price_alert_manage add.",
                                ),
                            "portfolioHint" to
                                mapOf(
                                    "type" to "string",
                                    "description" to "Optional portfolio or account nickname for price_alert_manage add.",
                                ),
                            "inPortfolio" to
                                mapOf("type" to "string", "description" to "Alias for portfolioHint."),
                            "confirmDestructive" to
                                mapOf(
                                    "type" to "boolean",
                                    "description" to "Must be true for price_alert_manage remove_symbol / clear_all after user confirms.",
                                ),
                        ),
                    "required" to listOf("operation"),
                ),
        )

    fun defaultYahooFinanceTool(): Map<String, Any?> =
        mapOf(
            "type" to "function",
            "name" to "yahoo_finance",
            "description" to
                "Fetch market quote data from Yahoo Finance. Return price, previousClose, change, and changePercent from the JSON in your answer.",
            "parameters" to
                mapOf(
                    "type" to "object",
                    "properties" to
                        mapOf(
                            "symbol" to
                                mapOf(
                                    "type" to "string",
                                    "description" to "Ticker symbol to quote (e.g. TSLA). Optional; defaults to TSLA.",
                                ),
                        ),
                ),
        )

    private fun documentToMap(doc: Document): Map<String, Any?> {
        val out = linkedMapOf<String, Any?>()
        doc.forEach { (k, v) -> out[k] = v }
        return out
    }
}
