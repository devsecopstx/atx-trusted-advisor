package com.atxfinance.backend.portfolio

import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.regex.Pattern

/**
 * Mirrors `upsertPositionSchema` / `openApiPositionSchema` + `normalizePositionPayload` in Next `positions/route.ts`.
 */
object PositionPayloadNormalizer {

    private val isoDate = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$")

    data class LegacyUpsert(
        val portfolioId: String,
        val accountId: String,
        val symbol: String,
        val qty: Double,
        val avgCost: Double,
    )

    sealed class Normalized {
        data class Ok(val data: LegacyUpsert) : Normalized()
        data class Err(val message: String) : Normalized()
    }

    fun parseLegacy(body: Map<String, Any?>): Normalized {
        val portfolioId = (body["portfolioId"] as? String)?.trim().orEmpty()
        val accountId = (body["accountId"] as? String)?.trim().orEmpty()
        val symbol = (body["symbol"] as? String)?.trim().orEmpty()
        if (portfolioId.isEmpty() || accountId.isEmpty() || symbol.isEmpty()) {
            return Normalized.Err("portfolioId, accountId, and symbol are required")
        }
        val qty = toPositiveDouble(body["qty"]) ?: return Normalized.Err("qty must be a positive number")
        val avgCost = toNonNegativeDouble(body["avgCost"]) ?: return Normalized.Err("avgCost must be a non-negative number")
        return Normalized.Ok(
            LegacyUpsert(
                portfolioId = portfolioId,
                accountId = accountId,
                symbol = symbol.uppercase(),
                qty = qty,
                avgCost = avgCost,
            ),
        )
    }

    fun parseOpenApi(body: Map<String, Any?>): Normalized {
        val portfolioId = (body["portfolioId"] as? String)?.trim().orEmpty()
        val accountId = (body["accountId"] as? String)?.trim().orEmpty()
        val ticker = (body["ticker"] as? String)?.trim().orEmpty()
        if (portfolioId.isEmpty() || accountId.isEmpty()) {
            return Normalized.Err("portfolioId and accountId are required")
        }
        val symbol = ticker.uppercase()
        if (symbol.isEmpty()) {
            return Normalized.Err("ticker is required")
        }

        val type = (body["type"] as? String)?.trim()?.lowercase() ?: "stock"
        val shares = toPositiveDouble(body["shares"])
        val contracts = toPositiveDouble(body["contracts"])
        val amount = toPositiveDouble(body["amount"])
        val purchasePrice = toNonNegativeDouble(body["purchasePrice"])
        val premium = toNonNegativeDouble(body["premium"])
        val expiration = (body["expiration"] as? String)?.trim()

        if (type == "cash") {
            val cashAmount = when {
                amount != null && amount > 0 -> amount
                shares != null && shares > 0 -> shares
                else -> null
            } ?: return Normalized.Err("cash positions require amount or shares")
            return Normalized.Ok(
                LegacyUpsert(portfolioId, accountId, symbol, qty = 1.0, avgCost = cashAmount),
            )
        }

        val qty = when {
            shares != null && shares > 0 -> shares
            contracts != null && contracts > 0 -> contracts
            else -> null
        } ?: return Normalized.Err(
            if (type == "option") {
                "option positions require shares or contracts"
            } else {
                "shares is required"
            },
        )

        val avgCost = when {
            purchasePrice != null && purchasePrice >= 0 -> purchasePrice
            premium != null && premium >= 0 -> premium
            else -> null
        } ?: return Normalized.Err("purchasePrice or premium is required")

        if (type == "option") {
            if (expiration.isNullOrEmpty()) {
                return Normalized.Err("option positions require expiration")
            }
            if (!isFutureIsoDate(expiration)) {
                return Normalized.Err("option expiration must be a future date in YYYY-MM-DD format")
            }
        }

        return Normalized.Ok(LegacyUpsert(portfolioId, accountId, symbol, qty, avgCost))
    }

    private fun toPositiveDouble(v: Any?): Double? =
        when (v) {
            is Number -> v.toDouble().takeIf { it.isFinite() && it > 0 }
            is String -> v.trim().toDoubleOrNull()?.takeIf { it.isFinite() && it > 0 }
            else -> null
        }

    private fun toNonNegativeDouble(v: Any?): Double? =
        when (v) {
            is Number -> v.toDouble().takeIf { it.isFinite() && it >= 0 }
            is String -> v.trim().replace(Regex("[$,\\s]"), "").toDoubleOrNull()?.takeIf { it.isFinite() && it >= 0 }
            else -> null
        }

    private fun isFutureIsoDate(value: String): Boolean {
        if (!isoDate.matcher(value).matches()) {
            return false
        }
        val parsed = runCatching {
            LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE)
        }.getOrNull() ?: return false
        val todayUtc = LocalDate.now(ZoneOffset.UTC)
        return parsed.isAfter(todayUtc)
    }
}
