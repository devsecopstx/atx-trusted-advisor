package com.atxfinance.backend.admin

import org.bson.Document

/**
 * Portfolio strategy scoring factors — parity with Next.js `scoring-factors.ts`.
 * Composite: score = 100 * Σ (weight * S_i), each S_i in [0,1].
 */
internal object AdminPortfolioScoringSupport {
    private const val WEIGHT_SUM_TOLERANCE = 0.002

    private val FACTOR_ORDER =
        listOf(
            "iv_rank",
            "open_interest",
            "volume",
            "liquidity",
            "portfolio_fit",
            "strategy_alignment",
        )

    private val CATALOG: Map<String, Triple<String, String, String>> =
        mapOf(
            "iv_rank" to
                Triple(
                    "IV Rank",
                    "How high is implied vol vs 1-year history (0–100)",
                    "IV rank percentile mapped to 0–1 (S_IV).",
                ),
            "open_interest" to
                Triple(
                    "Open Interest",
                    "Total OI on the chain (log-scaled + normalized)",
                    "Log-scale OI then min–max to 0–1 (S_OI).",
                ),
            "volume" to
                Triple(
                    "Volume",
                    "Daily option volume (normalized)",
                    "Volume normalized to 0–1 vs cohort (S_Vol).",
                ),
            "liquidity" to
                Triple(
                    "Liquidity",
                    "Average bid–ask spread % (lower = better)",
                    "Spread inverted and scaled to 0–1 (S_Liq).",
                ),
            "portfolio_fit" to
                Triple(
                    "Portfolio Fit",
                    "Delta match with existing holdings",
                    "Delta alignment score 0–1 (S_Port).",
                ),
            "strategy_alignment" to
                Triple(
                    "Strategy Alignment",
                    "How well strategy matches user outlook + risk tolerance",
                    "Outlook/risk match 0–1 (S_Align).",
                ),
        )

    private val DEFAULT_WEIGHTS: Map<String, Double> =
        mapOf(
            "iv_rank" to 0.30,
            "open_interest" to 0.20,
            "volume" to 0.15,
            "liquidity" to 0.10,
            "portfolio_fit" to 0.15,
            "strategy_alignment" to 0.10,
        )

    fun scoringFactorsForApi(stored: Any?): List<Map<String, Any?>> {
        val parsed = parseAndValidateList(stored)
        val rows = parsed ?: defaultFactorsRows()
        return sortByCatalog(rows).map { row ->
            val id = row["id"] as String
            val w = row["weight"] as Double
            val (label, desc, norm) = CATALOG[id]!!
            mapOf(
                "id" to id,
                "weight" to w,
                "label" to label,
                "description" to desc,
                "normalization" to norm,
            )
        }
    }

    /**
     * @return null = invalid stored doc (use defaults on wire), non-empty list = normalized rows for persistence check
     */
    fun parseAndValidateList(raw: Any?): List<Map<String, Any>>? {
        if (raw == null) {
            return null
        }
        if (raw !is List<*>) {
            return null
        }
        val rows = mutableListOf<Map<String, Any>>()
        val seen = mutableSetOf<String>()
        var sum = 0.0
        for (item in raw) {
            if (item !is Map<*, *>) {
                return null
            }
            val id = item["id"] as? String ?: return null
            if (!CATALOG.containsKey(id) || id in seen) {
                return null
            }
            val weight =
                when (val w = item["weight"]) {
                    is Number -> w.toDouble()
                    else -> return null
                }
            if (!weight.isFinite() || weight < 0.0 || weight > 1.0) {
                return null
            }
            seen.add(id)
            sum += weight
            rows.add(mapOf("id" to id, "weight" to weight))
        }
        if (rows.isEmpty()) {
            return null
        }
        if (kotlin.math.abs(sum - 1.0) > WEIGHT_SUM_TOLERANCE) {
            return null
        }
        return sortByCatalog(rows)
    }

    fun toBsonDocuments(rows: List<Map<String, Any>>): List<Document> = rows.map { Document(mapOf("id" to it["id"], "weight" to it["weight"])) }

    private fun defaultFactorsRows(): List<Map<String, Any>> =
        FACTOR_ORDER.map { id -> mapOf("id" to id, "weight" to DEFAULT_WEIGHTS[id]!!) }

    private fun sortByCatalog(rows: List<Map<String, Any>>): List<Map<String, Any>> {
        val order = FACTOR_ORDER.withIndex().associate { it.value to it.index }
        return rows.sortedBy { order[it["id"] as String] ?: 99 }
    }
}
