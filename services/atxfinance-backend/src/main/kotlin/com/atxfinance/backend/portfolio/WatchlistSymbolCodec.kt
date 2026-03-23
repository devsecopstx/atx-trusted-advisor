package com.atxfinance.backend.portfolio

import org.bson.Document
import java.time.Instant
import java.util.Date

/** Ports `normalizeWatchlistDocumentSymbols` + entry coercion from `repository.ts`. */
object WatchlistSymbolCodec {
    private val symbolRegex = Regex("^[A-Z0-9.\\-]{1,32}$")

    fun normalizeDocumentSymbols(raw: Any?, ensureSymbols: List<String>): List<Document> {
        val arr = when (raw) {
            is List<*> -> raw
            else -> emptyList<Any?>()
        }
        val bySymbol = LinkedHashMap<String, Document>()
        val now = Date()
        for (item in arr) {
            val doc = coerceWatchlistSymbolEntry(item, now) ?: continue
            val sym = doc.getString("symbol") ?: continue
            if (!bySymbol.containsKey(sym)) {
                bySymbol[sym] = doc
            }
        }
        val ensureUnique = ensureSymbols.map { it.trim().uppercase() }.filter { it.isNotEmpty() }.distinct()
        for (symbol in ensureUnique) {
            if (!bySymbol.containsKey(symbol)) {
                bySymbol[symbol] = Document(mapOf("symbol" to symbol, "addedAt" to now))
            }
        }
        return bySymbol.values.toList()
    }

    private fun coerceWatchlistSymbolEntry(item: Any?, fallbackAddedAt: Date): Document? {
        when (item) {
            is String -> {
                val symbol = item.trim().uppercase()
                if (symbol.isEmpty() || !symbolRegex.matches(symbol)) {
                    return null
                }
                return Document(mapOf("symbol" to symbol, "addedAt" to fallbackAddedAt))
            }
            is Map<*, *> -> {
                val o = item.mapKeys { it.key.toString() }.mapValues { it.value }
                val symbol = (o["symbol"] as? String)?.trim()?.uppercase() ?: return null
                if (symbol.isEmpty() || !symbolRegex.matches(symbol)) {
                    return null
                }
                val doc = Document()
                doc["symbol"] = symbol
                val rawAdded = o["addedAt"]
                var addedAt = fallbackAddedAt
                when (rawAdded) {
                    is Date -> addedAt = rawAdded
                    is String -> {
                        runCatching { Instant.parse(rawAdded).toEpochMilli() }
                            .getOrNull()
                            ?.let { addedAt = Date(it) }
                    }
                }
                doc["addedAt"] = addedAt
                (o["lineType"] as? String)?.trim()?.takeIf { it.isNotEmpty() }?.let {
                    doc["lineType"] = it.take(128)
                }
                (o["strategy"] as? String)?.trim()?.takeIf { it.isNotEmpty() }?.let {
                    doc["strategy"] = it.take(512)
                }
                parseFiniteNumber(o["quantity"])?.let { doc["quantity"] = it }
                parseFiniteNumber(o["entryPrice"])?.let { doc["entryPrice"] = it }
                return doc
            }
            is Document -> {
                @Suppress("UNCHECKED_CAST")
                return coerceWatchlistSymbolEntry(item as Map<*, *>, fallbackAddedAt)
            }
            else -> return null
        }
    }

    private fun parseFiniteNumber(v: Any?): Double? =
        when (v) {
            is Number -> v.toDouble().takeIf { !it.isNaN() && it.isFinite() }
            is String -> v.replace(Regex("[$,\\s]"), "").toDoubleOrNull()?.takeIf { it.isFinite() }
            else -> null
        }

    fun mergeImportEntry(base: Document, entry: Map<String, Any?>): Document {
        val next = Document(base)
        entry["lineType"]?.let { lt ->
            val v = (lt as? String)?.trim() ?: ""
            if (v.isEmpty()) {
                next.remove("lineType")
            } else {
                next["lineType"] = v.take(128)
            }
        }
        entry["strategy"]?.let { st ->
            val v = (st as? String)?.trim() ?: ""
            if (v.isEmpty()) {
                next.remove("strategy")
            } else {
                next["strategy"] = v.take(512)
            }
        }
        entry["quantity"]?.let {
            parseFiniteNumber(it)?.let { n -> next["quantity"] = n } ?: next.remove("quantity")
        }
        entry["entryPrice"]?.let {
            parseFiniteNumber(it)?.let { n -> next["entryPrice"] = n } ?: next.remove("entryPrice")
        }
        return next
    }
}
