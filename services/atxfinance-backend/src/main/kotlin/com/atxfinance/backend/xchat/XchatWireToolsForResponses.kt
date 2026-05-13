package com.atxfinance.backend.xchat

import java.util.LinkedHashMap
import java.util.Locale

/**
 * Normalizes persona / Mongo `xapi.tools` entries into xAI **`POST /v1/responses`** wire shape.
 *
 * Next parity: `src/lib/xai-tools.ts` (`flattenFunctionToolForXaiResponses`, marker expansion, `fileSearchWireTool`).
 * xAI **`POST /v1/responses`** requires hosted **`file_search`** with **`vector_store_ids`** (not legacy
 * **`source.collection_ids`** alone) — otherwise **`tools[N]: missing field vector_store_ids`** (422).
 */
object XchatWireToolsForResponses {
    private val PASSTHROUGH_HOSTED_TYPES =
        setOf(
            "web_search",
            "x_search",
            "code_interpreter",
            "code_execution",
            "mcp",
            "shell",
        )

    fun normalize(tools: List<Map<String, Any?>>): List<Map<String, Any?>> {
        val out = mutableListOf<Map<String, Any?>>()
        for (tool in tools) {
            val typeKey = toolTypeKey(tool)
            when (typeKey) {
                "collections_search" -> {
                    val ids =
                        (tool["collection_ids"] as? List<*>)
                            ?.mapNotNull { it?.toString()?.trim() }
                            ?.filter { it.isNotEmpty() }
                            .orEmpty()
                    if (ids.isNotEmpty()) {
                        out.add(fileSearchWireTool(ids))
                    }
                }
                "file_search" -> {
                    val ids = vectorStoreIdsFromTool(tool)
                    if (ids.isNotEmpty()) {
                        out.add(fileSearchWireTool(ids))
                    }
                }
                "function" -> {
                    val flat = flattenFunctionToolForXaiResponses(tool)
                    out.add(mapLocalFunctionNameToCanonical(flat))
                }
                "atx_function", "atxfinance" -> out.add(XchatPersonaSupport.defaultAtxFunctionTool())
                "yahoo_finance" -> out.add(XchatPersonaSupport.defaultYahooFinanceTool())
                else -> {
                    val nested = tool["function"] as? Map<*, *>
                    if (nested != null) {
                        val flat = flattenFunctionToolForXaiResponses(tool)
                        out.add(mapLocalFunctionNameToCanonical(flat))
                    } else if (typeKey.isNotEmpty() && typeKey in PASSTHROUGH_HOSTED_TYPES) {
                        out.add(ensureHostedToolName(tool, typeKey))
                    }
                }
            }
        }

        val dedup = LinkedHashMap<String, Map<String, Any?>>()
        for (t in out) {
            val name = t["name"]?.toString()?.trim() ?: continue
            dedup.putIfAbsent(name, t)
        }
        val merged = dedup.values.toMutableList()
        if (merged.none { it["name"] == "atx_function" }) {
            merged.add(XchatPersonaSupport.defaultAtxFunctionTool())
        }
        return merged.take(32)
    }

    private fun toolTypeKey(tool: Map<String, Any?>): String =
        tool["type"]?.let { it.toString().trim().lowercase(Locale.US) }.orEmpty()

    /** Same idea as Next `vectorStoreIdsFromTool` — xAI collection ids map to `vector_store_ids` on the wire. */
    private fun vectorStoreIdsFromTool(tool: Map<String, Any?>): List<String> {
        val out = LinkedHashSet<String>()
        fun addAll(raw: List<*>?) {
            raw?.forEach { id ->
                id?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let(out::add)
            }
        }
        addAll(tool["vector_store_ids"] as? List<*>)
        val source = tool["source"] as? Map<*, *>
        addAll(source?.get("collection_ids") as? List<*>)
        addAll(tool["collection_ids"] as? List<*>)
        return out.toList()
    }

    private fun fileSearchWireTool(ids: List<String>): Map<String, Any?> =
        mapOf(
            "type" to "file_search",
            "name" to "file_search",
            "vector_store_ids" to ids,
        )

    /**
     * xAI `/v1/responses` expects flat function tools: `type`, `name`, `parameters` at the root
     * (OpenAI-style `{ type, function: { name, parameters } }` is flattened here).
     */
    private fun flattenFunctionToolForXaiResponses(tool: Map<String, Any?>): Map<String, Any?> {
        if (tool["type"]?.toString() != "function") {
            return tool
        }
        val nested = tool["function"] as? Map<*, *> ?: return ensureFunctionParameters(tool)
        val fn = nested.entries.associate { it.key.toString() to it.value }
        val name =
            (tool["name"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
                ?: (fn["name"] as? String)?.trim().orEmpty()
        val flattened = LinkedHashMap<String, Any?>()
        flattened["type"] = "function"
        flattened["name"] = name
        val params = fn["parameters"]
        flattened["parameters"] =
            if (params != null && params is Map<*, *>) {
                @Suppress("UNCHECKED_CAST")
                params as Map<String, Any?>
            } else {
                mapOf("type" to "object", "properties" to emptyMap<String, Any?>())
            }
        val desc = fn["description"] as? String
        if (!desc.isNullOrBlank()) {
            flattened["description"] = desc
        }
        return flattened
    }

    private fun ensureFunctionParameters(tool: Map<String, Any?>): Map<String, Any?> {
        if (tool["parameters"] == null) {
            val copy = LinkedHashMap(tool)
            copy["parameters"] = mapOf("type" to "object", "properties" to emptyMap<String, Any?>())
            return copy
        }
        return tool
    }

    /** Map wire **`function`** tools whose **`name`** is a Next persona marker to canonical JVM executors. */
    private fun mapLocalFunctionNameToCanonical(flat: Map<String, Any?>): Map<String, Any?> {
        val innerName = (flat["name"] as? String)?.trim()?.lowercase(Locale.US).orEmpty()
        return when (innerName) {
            "yahoo_finance" -> XchatPersonaSupport.defaultYahooFinanceTool()
            "atx_function", "atxfinance" -> XchatPersonaSupport.defaultAtxFunctionTool()
            else -> flat
        }
    }

    private fun ensureHostedToolName(
        tool: Map<String, Any?>,
        typeKey: String,
    ): Map<String, Any?> {
        if (tool["name"] != null) {
            return tool
        }
        val copy = LinkedHashMap(tool)
        copy["name"] = typeKey
        return copy
    }
}
