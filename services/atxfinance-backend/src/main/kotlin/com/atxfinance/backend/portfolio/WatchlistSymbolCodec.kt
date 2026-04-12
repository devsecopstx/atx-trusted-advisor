package com.atxfinance.backend.portfolio

import org.bson.Document
import java.time.Instant
import java.util.Date

/** Ports `normalizeWatchlistDocumentSymbols` + entry coercion from `repository.ts` (ordered rows; duplicate tickers kept). */
object WatchlistSymbolCodec {
    private val symbolRegex = Regex("^[A-Z0-9.\\-]{1,32}$")

    fun normalizeDocumentSymbols(raw: Any?, ensureSymbols: List<String>): List<Document> {
        val arr = when (raw) {
            is List<*> -> raw
            else -> emptyList<Any?>()
        }
        val now = Date()
        val out = mutableListOf<Document>()
        for (item in arr) {
            val doc = coerceWatchlistSymbolEntry(item, now) ?: continue
            out.add(doc)
        }
        val present = out.mapNotNull { it.getString("symbol") }.toMutableSet()
        val ensureUnique = ensureSymbols.map { it.trim().uppercase() }.filter { it.isNotEmpty() }.distinct()
        for (symbol in ensureUnique) {
            if (!present.contains(symbol)) {
                out.add(Document(mapOf("symbol" to symbol, "addedAt" to now)))
                present.add(symbol)
            }
        }
        return out
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
                parseFiniteNumber(o["priceAlertMinAbsMovePercent"])?.takeIf { it > 0 }?.let { v ->
                    doc["priceAlertMinAbsMovePercent"] = v.coerceIn(0.1, 100.0)
                }
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
        if (entry.containsKey("lineType")) {
            val lt = entry["lineType"]
            val v = (lt as? String)?.trim() ?: ""
            if (v.isEmpty()) {
                next.remove("lineType")
            } else {
                next["lineType"] = v.take(128)
            }
        }
        if (entry.containsKey("strategy")) {
            val st = entry["strategy"]
            val v = (st as? String)?.trim() ?: ""
            if (v.isEmpty()) {
                next.remove("strategy")
            } else {
                next["strategy"] = v.take(512)
            }
        }
        if (entry.containsKey("quantity")) {
            val q = entry["quantity"]
            parseFiniteNumber(q)?.let { n -> next["quantity"] = n } ?: next.remove("quantity")
        }
        if (entry.containsKey("entryPrice")) {
            val p = entry["entryPrice"]
            parseFiniteNumber(p)?.let { n -> next["entryPrice"] = n } ?: next.remove("entryPrice")
        }
        if (entry.containsKey("priceAlertMinAbsMovePercent")) {
            val p = entry["priceAlertMinAbsMovePercent"]
            if (p == null) {
                next.remove("priceAlertMinAbsMovePercent")
            } else {
                parseFiniteNumber(p)?.takeIf { it > 0 }?.let { v ->
                    next["priceAlertMinAbsMovePercent"] = v.coerceIn(0.1, 100.0)
                } ?: next.remove("priceAlertMinAbsMovePercent")
            }
        }
        return next
    }
}
