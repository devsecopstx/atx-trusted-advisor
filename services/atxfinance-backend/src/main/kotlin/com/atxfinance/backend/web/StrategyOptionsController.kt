package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.strategy.StrategyOptionsYahooClient
import com.fasterxml.jackson.databind.JsonNode
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

@RestController
class StrategyOptionsController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val yahooClient: StrategyOptionsYahooClient,
) {

    private val underlyingPattern = Regex("^[A-Z0-9.\\-^]+$")

    @GetMapping("/api/strategy-options/expirations")
    fun expirations(
        request: HttpServletRequest,
        @RequestParam(name = "underlying", required = false) underlyingRaw: String?,
    ): ResponseEntity<Map<String, Any?>> {
        if (sessionCookieParser.resolveSessionUser(
                request.getHeader("Cookie"),
                props.sessionCookieName,
            ) == null
        ) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        }
        val underlying = parseUnderlying(underlyingRaw)
            ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "underlying is required"))
        val root = yahooClient.fetchOptionsJson(underlying, null)
            ?: return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                mapOf("error" to "Failed to fetch expiration dates"),
            )
        val dates = StrategyOptionsYahooClient.expirationDatesFromYahoo(root)
        return ResponseEntity.ok(mapOf("underlying" to underlying, "expirationDates" to dates))
    }

    @GetMapping("/api/strategy-options")
    fun chain(
        request: HttpServletRequest,
        @RequestParam(name = "underlying", required = false) underlyingRaw: String?,
        @RequestParam(name = "expiration", required = false) expirationRaw: String?,
        @RequestParam(name = "strike", required = false) strikeRaw: String?,
    ): ResponseEntity<Map<String, Any?>> {
        if (sessionCookieParser.resolveSessionUser(
                request.getHeader("Cookie"),
                props.sessionCookieName,
            ) == null
        ) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        }
        val underlying = parseUnderlying(underlyingRaw)
            ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "underlying is required"))
        val expirationNorm = normalizeExpiration(expirationRaw)
            ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("error" to "expiration must be YYYY-MM-DD or Yahoo unix seconds"),
            )
        val targetStrike = parseStrike(strikeRaw)

        val epoch = LocalDate.parse(expirationNorm, DateTimeFormatter.ISO_LOCAL_DATE)
            .atStartOfDay(ZoneOffset.UTC)
            .toEpochSecond()
        val root = yahooClient.fetchOptionsJson(underlying, epoch)
        val quoteRoot = yahooClient.fetchOptionsJson(underlying, null)
        var stockPrice = targetStrike
        if (quoteRoot != null) {
            val q = StrategyOptionsYahooClient.firstResult(quoteRoot)?.path("quote")?.get(0)
            val p = q?.path("regularMarketPrice")?.asDouble(0.0) ?: 0.0
            if (p > 0) {
                stockPrice = p
            }
        }
        val expDate = LocalDate.parse(expirationNorm, DateTimeFormatter.ISO_LOCAL_DATE)
        val today = LocalDate.now(ZoneOffset.UTC)
        val daysToExp = max(1, ChronoUnit.DAYS.between(today, expDate).toInt().coerceAtLeast(1))

        val yahooBuilt = root?.let { buildYahooChain(underlying, expirationNorm, targetStrike, stockPrice, daysToExp, it) }
        if (yahooBuilt != null) {
            return ResponseEntity.ok(yahooBuilt)
        }

        val synthetic = buildSyntheticChain(underlying, expirationNorm, targetStrike, stockPrice, daysToExp)
        return ResponseEntity.ok(synthetic)
    }

    private fun parseUnderlying(raw: String?): String? {
        val u = raw?.trim()?.uppercase() ?: return null
        if (u.isEmpty()) {
            return null
        }
        if (u.length > 32 || !underlyingPattern.matches(u)) {
            return null
        }
        return u
    }

    private fun normalizeExpiration(raw: String?): String? {
        val trimmed = raw?.trim() ?: return null
        val asUnix = trimmed.toLongOrNull()
        if (asUnix != null && asUnix in 1_000_000_000..2_000_000_000L) {
            return Instant.ofEpochSecond(asUnix).atZone(ZoneOffset.UTC).toLocalDate()
                .format(DateTimeFormatter.ISO_LOCAL_DATE)
        }
        val s = trimmed.take(10)
        if (!Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(s)) {
            return null
        }
        return try {
            LocalDate.parse(s, DateTimeFormatter.ISO_LOCAL_DATE)
            s
        } catch (_: Exception) {
            null
        }
    }

    private fun parseStrike(raw: String?): Double {
        if (raw.isNullOrBlank()) {
            return 0.0
        }
        val n = raw.trim().toDoubleOrNull() ?: return 0.0
        if (!n.isFinite() || n < 0 || n > 1_000_000_000) {
            return 0.0
        }
        return n
    }

    private fun buildYahooChain(
        underlying: String,
        requestedExpiration: String,
        targetStrike: Double,
        stockPrice: Double,
        daysToExp: Int,
        root: JsonNode,
    ): Map<String, Any?>? {
        val first = StrategyOptionsYahooClient.firstResult(root) ?: return null
        val optionsArr = first.path("options")
        if (!optionsArr.isArray || optionsArr.size() == 0) {
            return null
        }
        val group = findExpirationGroup(optionsArr, requestedExpiration) ?: return null
        val actualExp = expirationDateString(group.path("expiration").asLong(0L))
        val calls = group.path("calls")
        val puts = group.path("puts")
        val chain = mergeCallsPuts(calls, puts, underlying, actualExp, stockPrice, daysToExp)
        if (chain.isEmpty()) {
            return null
        }
        val note = if (actualExp != requestedExpiration) {
            "Showing options expiring $actualExp (closest to requested date)."
        } else {
            "Live data from Yahoo Finance. Prices may be delayed."
        }
        val strikeTolerance = if (targetStrike > 0) targetStrike * 0.15 else stockPrice * 0.15
        return mapOf(
            "underlying" to underlying,
            "expiration" to actualExp,
            "requestedExpiration" to requestedExpiration,
            "targetStrike" to targetStrike,
            "stockPrice" to stockPrice,
            "daysToExpiration" to daysToExp,
            "strikeTolerance" to strikeTolerance,
            "totalCalls" to chain.count { it["call"] != null },
            "totalPuts" to chain.count { it["put"] != null },
            "optionChain" to chain,
            "dataSource" to "yahoo",
            "note" to note,
        )
    }

    private fun expirationDateString(epochSec: Long): String {
        if (epochSec <= 0L) {
            return ""
        }
        return Instant.ofEpochSecond(epochSec).atZone(ZoneOffset.UTC).toLocalDate()
            .format(DateTimeFormatter.ISO_LOCAL_DATE)
    }

    private fun findExpirationGroup(optionsArr: JsonNode, expTarget: String): JsonNode? {
        var best: JsonNode? = null
        var bestDiff = Long.MAX_VALUE
        val targetTime = LocalDate.parse(expTarget, DateTimeFormatter.ISO_LOCAL_DATE)
            .atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        for (g in optionsArr) {
            val exp = g.path("expiration").asLong(0L)
            val ds = expirationDateString(exp)
            if (ds == expTarget) {
                return g
            }
            val t = Instant.ofEpochSecond(exp).toEpochMilli()
            val diff = abs(t - targetTime)
            if (diff < bestDiff) {
                bestDiff = diff
                best = g
            }
        }
        return best
    }

    private fun mergeCallsPuts(
        calls: JsonNode,
        puts: JsonNode,
        underlying: String,
        expiration: String,
        stockPrice: Double,
        daysToExp: Int,
    ): List<Map<String, Any?>> {
        data class Row(val strike: Double, var call: Map<String, Any?>?, var put: Map<String, Any?>?)
        val byStrike = LinkedHashMap<Double, Row>()
        if (calls.isArray) {
            for (c in calls) {
                val strike = c.path("strike").asDouble(0.0)
                if (strike <= 0) continue
                val row = byStrike.getOrPut(strike) { Row(strike, null, null) }
                row.call = mapYahooContract(c, underlying, expiration, "call", stockPrice, daysToExp)
            }
        }
        if (puts.isArray) {
            for (p in puts) {
                val strike = p.path("strike").asDouble(0.0)
                if (strike <= 0) continue
                val row = byStrike.getOrPut(strike) { Row(strike, null, null) }
                row.put = mapYahooContract(p, underlying, expiration, "put", stockPrice, daysToExp)
            }
        }
        return byStrike.keys.sorted().map { k ->
            val r = byStrike[k]!!
            mapOf("strike" to k, "call" to r.call, "put" to r.put)
        }
    }

    private fun mapYahooContract(
        n: JsonNode,
        @Suppress("UNUSED_PARAMETER") underlying: String,
        expiration: String,
        type: String,
        stockPrice: Double,
        daysToExp: Int,
    ): Map<String, Any?> {
        val strike = n.path("strike").asDouble(0.0)
        val bid = n.path("bid").asDouble(0.0)
        val ask = n.path("ask").asDouble(0.0)
        val last = n.path("lastPrice").asDouble(0.0)
        val premium = when {
            last > 0 -> last
            bid > 0 && ask > 0 -> (bid + ask) / 2
            else -> max(bid, ask)
        }
        // Align with Next `mapContract` (options-chain.ts): when Yahoo has last trade but no NBBO,
        // use premium for both legs so xOptions liquidity filter keeps the row (staging BFF path).
        val quoteBid = if (bid > 0) bid else premium
        val quoteAsk = if (ask > 0) ask else premium
        val iv = n.path("impliedVolatility").asDouble(0.0)
        val vol = n.path("volume").asLong(0L).toInt()
        val oi = n.path("openInterest").asLong(0L).toInt()
        val sym = n.path("contractSymbol").asText("") ?: ""
        val prob = if (type == "call") {
            probabilityItm(stockPrice, strike, daysToExp, iv)
        } else {
            null
        }
        val probOtm = if (type == "put") {
            probabilityItm(stockPrice, strike, daysToExp, iv)
        } else {
            null
        }
        return mapOf(
            "ticker" to "O:$sym",
            "yahoo_symbol" to sym,
            "strike_price" to strike,
            "expiration_date" to expiration,
            "contract_type" to type,
            "premium" to premium,
            "totalPremium" to (premium * 100),
            "last_quote" to mapOf("bid" to quoteBid, "ask" to quoteAsk),
            "volume" to vol,
            "open_interest" to oi,
            "implied_volatility" to (iv * 100),
            "rationale" to "Yahoo quote",
            "probability_called_away" to prob,
            "probability_expire_otm" to probOtm,
            "dataSource" to "yahoo",
        )
    }

    private fun normCdf(x: Double): Double {
        val a1 = 0.254829592
        val a2 = -0.284496736
        val a3 = 1.421413741
        val a4 = -1.453152027
        val a5 = 1.061405429
        val p = 0.3275911
        val sign = if (x < 0) -1 else 1
        val ax = kotlin.math.abs(x) / sqrt(2.0)
        val t = 1.0 / (1.0 + p * ax)
        val y =
            1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * exp(-ax * ax)
        return 0.5 * (1.0 + sign * y)
    }

    private fun probabilityItm(stock: Double, strike: Double, days: Int, ivDecimal: Double): Double {
        if (stock <= 0 || strike <= 0 || days <= 0 || ivDecimal <= 0) {
            return 0.0
        }
        val t = days / 365.0
        val sigma = ivDecimal
        val r = 0.05
        val d2 = (ln(stock / strike) + (r - sigma * sigma / 2) * t) / (sigma * sqrt(t))
        return normCdf(d2)
    }

    private fun buildSyntheticChain(
        underlying: String,
        expiration: String,
        targetStrike: Double,
        stockPrice: Double,
        daysToExp: Int,
    ): Map<String, Any?> {
        val anchor = if (targetStrike > 0) targetStrike else stockPrice
        val calls = generateSyntheticOptions(underlying, expiration, anchor, "call", stockPrice, daysToExp)
        val puts = generateSyntheticOptions(underlying, expiration, anchor, "put", stockPrice, daysToExp)
        val strikes = (calls.map { it["strike_price"] as Double } + puts.map { it["strike_price"] as Double })
            .distinct()
            .sorted()
        val optionChain = strikes.map { s ->
            val c = calls.find { (it["strike_price"] as Double) == s }
            val p = puts.find { (it["strike_price"] as Double) == s }
            mapOf("strike" to s, "call" to c, "put" to p)
        }
        return mapOf(
            "underlying" to underlying,
            "expiration" to expiration,
            "requestedExpiration" to expiration,
            "targetStrike" to anchor,
            "stockPrice" to stockPrice,
            "daysToExpiration" to daysToExp,
            "strikeTolerance" to anchor * 0.15,
            "totalCalls" to calls.size,
            "totalPuts" to puts.size,
            "optionChain" to optionChain,
            "dataSource" to "synthetic",
            "note" to "Premiums are modeled (no live options feed). Actual market prices will vary.",
        )
    }

    private fun generateSyntheticOptions(
        underlying: String,
        expiration: String,
        targetStrike: Double,
        contractType: String,
        stockPrice: Double,
        daysToExp: Int,
    ): List<Map<String, Any?>> {
        val tol = targetStrike * 0.15
        val minS = max(0.01, targetStrike - tol)
        val maxS = targetStrike + tol
        val inc = when {
            stockPrice < 100 -> 2.5
            stockPrice < 500 -> 5.0
            else -> 10.0
        }
        val strikes = ArrayList<Double>()
        var s = floorToIncrement(minS, inc)
        while (s <= maxS) {
            if (s > 0) {
                strikes.add(s)
            }
            s += inc
        }
        return strikes.map { strikePrice ->
            val prem = estimatePremium(stockPrice, strikePrice, daysToExp, contractType == "call")
            val iv = estimateIv(stockPrice, strikePrice, prem.premium, daysToExp, contractType == "call")
            val vol = estimateVolume(stockPrice, strikePrice, daysToExp)
            val oi = estimateOi(stockPrice, strikePrice, daysToExp)
            val prob = probabilityItm(stockPrice, strikePrice, daysToExp, iv)
            mapOf(
                "ticker" to syntheticTicker(underlying, expiration, contractType == "call", strikePrice),
                "yahoo_symbol" to syntheticYahooSymbol(underlying, expiration, contractType == "call", strikePrice),
                "strike_price" to strikePrice,
                "expiration_date" to expiration,
                "contract_type" to if (contractType == "call") "call" else "put",
                "premium" to prem.premium,
                "totalPremium" to prem.premium * 100,
                "last_quote" to mapOf("bid" to prem.bid, "ask" to prem.ask),
                "volume" to vol,
                "open_interest" to oi,
                "implied_volatility" to (iv * 1000).roundToInt() / 10.0,
                "rationale" to "synthetic",
                "probability_called_away" to if (contractType == "call") prob else null,
                "probability_expire_otm" to if (contractType == "put") prob else null,
                "dataSource" to "synthetic",
            )
        }
    }

    private fun floorToIncrement(x: Double, inc: Double): Double {
        return floor(x / inc) * inc
    }

    private data class Prem(val bid: Double, val ask: Double, val premium: Double)

    private fun estimatePremium(stockPrice: Double, strikePrice: Double, daysToExp: Int, isCall: Boolean): Prem {
        val intrinsic = if (isCall) {
            max(0.0, stockPrice - strikePrice)
        } else {
            max(0.0, strikePrice - stockPrice)
        }
        val monthsToExp = daysToExp / 30.0
        val volatilityFactor = 0.015
        val moneyness = stockPrice / strikePrice
        val moneynessAdjustment = 1 - abs(1 - moneyness) * 0.5
        val timeValue = stockPrice * volatilityFactor * sqrt(monthsToExp) * moneynessAdjustment
        val premium = intrinsic + max(timeValue, 0.05)
        val spread = premium * 0.08
        val bid = max(0.01, premium - spread / 2)
        val ask = premium + spread / 2
        return Prem(
            (bid * 100).roundToInt() / 100.0,
            (ask * 100).roundToInt() / 100.0,
            (premium * 100).roundToInt() / 100.0,
        )
    }

    private fun estimateIv(stock: Double, strike: Double, premium: Double, days: Int, isCall: Boolean): Double {
        val timeYears = days / 365.0
        if (timeYears <= 0) {
            return 0.0
        }
        val atm = premium / (0.4 * stock * sqrt(timeYears))
        val moneyness = if (isCall) stock / strike else strike / stock
        val adj = 1 + abs(1 - moneyness) * 0.3
        val iv = atm * adj
        return min(2.0, max(0.1, iv))
    }

    private fun estimateVolume(stock: Double, strike: Double, days: Int): Int {
        val otm = abs(stock - strike) / stock
        val m = when {
            otm < 0.02 -> 2.5
            otm < 0.05 -> 1.8
            otm < 0.10 -> 1.3
            else -> 1.0
        }
        val t = when {
            days < 14 -> 0.7
            days < 30 -> 1.0
            days < 60 -> 1.2
            else -> 1.4
        }
        return max(10, (2500 * m * t).roundToInt())
    }

    private fun estimateOi(stock: Double, strike: Double, days: Int): Int {
        val otm = abs(stock - strike) / stock
        val m = when {
            otm < 0.02 -> 2.2
            otm < 0.05 -> 1.6
            otm < 0.10 -> 1.2
            else -> 1.0
        }
        val t = when {
            days < 30 -> 1.4
            days < 60 -> 1.15
            else -> 1.0
        }
        return max(10, (3500 * m * t).roundToInt())
    }

    private fun syntheticYahooSymbol(underlying: String, expiration: String, isCall: Boolean, strikePrice: Double): String {
        val ymd = expiration.replace("-", "")
        val expDate = if (ymd.length >= 8) ymd.substring(2) else ymd
        val typeChar = if (isCall) "C" else "P"
        val strikeStr = String.format("%08d", (strikePrice * 1000).roundToInt())
        return "$underlying$expDate$typeChar$strikeStr"
    }

    private fun syntheticTicker(underlying: String, expiration: String, isCall: Boolean, strikePrice: Double): String {
        val ymd = expiration.replace("-", "")
        val yy = if (ymd.length >= 8) ymd.substring(2) else ymd
        val c = if (isCall) "C" else "P"
        val strikeStr = String.format("%08d", (strikePrice * 1000).roundToInt())
        return "O:$underlying$yy$c$strikeStr"
    }
}
