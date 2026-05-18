package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.UsEquitiesRegularSession
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.concurrent.atomic.AtomicInteger

@Component
class StrategyOptionsYahooClient(
    private val objectMapper: ObjectMapper,
    @Qualifier("cacheRedisTemplate")
    private val redisProvider: ObjectProvider<StringRedisTemplate>,
    private val propsProvider: ObjectProvider<AtxfinanceProperties>,
) {
    private val client: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(8))
        .build()

    private val userAgent =
        "Mozilla/5.0 (compatible; atxfinance-backend/1.0; +https://fintech-advisor.ai)"

    /** Yahoo HTTP latency / error circuit: after repeated slow (>12s) or failed calls, pause outbound fetch briefly (cache still honored). */
    private val yahooBreakerFailures = AtomicInteger(0)
    @Volatile
    private var yahooBreakerOpenUntilNanos: Long = 0L

    fun fetchOptionsJson(underlying: String, dateEpochSeconds: Long?): JsonNode? {
        val u = underlying.trim().uppercase()
        if (u.isEmpty()) {
            return null
        }
        val epochKey = dateEpochSeconds?.takeIf { it > 0 } ?: 0L
        val cacheKey = "xf:oyahoo:v1:$u:$epochKey"

        val redis = redisProvider.ifAvailable
        val props = propsProvider.ifAvailable
        if (redis != null && props != null) {
            try {
                val cached = redis.opsForValue().get(cacheKey)
                if (!cached.isNullOrBlank()) {
                    return objectMapper.readTree(cached)
                }
            } catch (_: Exception) {
                /* fall through */
            }
        }

        val body = fetchOptionsJsonHttp(u, dateEpochSeconds) ?: return null

        if (redis != null && props != null) {
            val ttl = resolveOptionChainCacheTtlSeconds(props)
            try {
                redis.opsForValue().set(cacheKey, body, Duration.ofSeconds(ttl))
            } catch (_: Exception) {
                /* ignore */
            }
        }

        return try {
            objectMapper.readTree(body)
        } catch (_: Exception) {
            null
        }
    }

    private fun resolveOptionChainCacheTtlSeconds(props: AtxfinanceProperties): Long {
        val open = UsEquitiesRegularSession.isRegularSessionLikelyOpen(Instant.now())
        return if (open) {
            props.redis.optionChainCacheTtlOpenSeconds
        } else {
            props.redis.optionChainCacheTtlClosedSeconds
        }.coerceIn(15L, 7200L)
    }

    private fun fetchOptionsJsonHttp(underlying: String, dateEpochSeconds: Long?): String? {
        val now = System.nanoTime()
        if (now < yahooBreakerOpenUntilNanos) {
            return null
        }
        val base = "https://query1.finance.yahoo.com/v7/finance/options/$underlying"
        val url = if (dateEpochSeconds != null && dateEpochSeconds > 0) {
            "$base?date=$dateEpochSeconds"
        } else {
            base
        }
        val req = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofSeconds(20))
            .header("User-Agent", userAgent)
            .GET()
            .build()
        val t0 = System.nanoTime()
        val resp = try {
            client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
        } catch (_: Exception) {
            recordYahooBreakerFailure()
            return null
        }
        val elapsedMs = (System.nanoTime() - t0) / 1_000_000L
        if (elapsedMs > 12_000L) {
            recordYahooBreakerFailure()
        } else {
            yahooBreakerFailures.set(0)
        }
        if (resp.statusCode() !in 200..299) {
            recordYahooBreakerFailure()
            return null
        }
        return resp.body()
    }

    private fun recordYahooBreakerFailure() {
        val n = yahooBreakerFailures.incrementAndGet()
        if (n >= 3) {
            yahooBreakerFailures.set(0)
            yahooBreakerOpenUntilNanos = System.nanoTime() + Duration.ofSeconds(30).toNanos()
        }
    }

    /**
     * Single-symbol quote for xChat `market_quote` / `yahoo_finance` (Redis cache first, then v7 quote API).
     */
    fun fetchEquityQuote(symbol: String): Map<String, Any?>? {
        val sym = symbol.trim().uppercase()
        if (sym.isEmpty()) {
            return null
        }
        val cacheKey = "xchat:market_quote:$sym"
        val redis = redisProvider.ifAvailable
        val props = propsProvider.ifAvailable
        if (redis != null) {
            try {
                val cached = redis.opsForValue().get(cacheKey)
                if (!cached.isNullOrBlank()) {
                    val node = objectMapper.readTree(cached)
                    val price =
                        sequenceOf(
                                node.path("price"),
                                node.path("regularMarketPrice"),
                            )
                            .mapNotNull { n ->
                                val d = n.asDouble(Double.NaN)
                                d.takeIf { it.isFinite() && it > 0 }
                            }
                            .firstOrNull()
                    if (price != null) {
                        return mapOf(
                            "symbol" to sym,
                            "regularMarketPrice" to price,
                            "regularMarketPreviousClose" to node.path("previousClose").asDouble(Double.NaN).takeIf { it.isFinite() },
                            "regularMarketChange" to node.path("change").asDouble(Double.NaN).takeIf { it.isFinite() },
                            "regularMarketChangePercent" to node.path("changePercent").asDouble(Double.NaN).takeIf { it.isFinite() },
                            "currency" to node.path("currency").asText(""),
                            "source" to "yahoo-finance2",
                        )
                    }
                }
            } catch (_: Exception) {
                /* miss */
            }
        }

        val resolved =
            fetchEquityQuoteFromChart(sym)
                ?: fetchEquityQuoteBatch(listOf(sym))[sym]
                ?: fetchUnderlyingQuote(sym)
                ?: return null

        if (redis != null && props != null) {
            val ttl =
                if (UsEquitiesRegularSession.isRegularSessionLikelyOpen(Instant.now())) {
                    props.redis.optionChainCacheTtlOpenSeconds
                } else {
                    props.redis.optionChainCacheTtlClosedSeconds
                }.coerceIn(15L, 7200L)
            val price = (resolved["regularMarketPrice"] as? Number)?.toDouble()?.takeIf { it.isFinite() && it > 0 }
            if (price != null) {
                val cacheDoc =
                    mapOf(
                        "symbol" to sym,
                        "price" to price,
                        "previousClose" to (resolved["regularMarketPreviousClose"] as? Number)?.toDouble(),
                        "change" to (resolved["regularMarketChange"] as? Number)?.toDouble(),
                        "changePercent" to (resolved["regularMarketChangePercent"] as? Number)?.toDouble(),
                        "currency" to resolved["currency"],
                        "source" to "yahoo-finance2",
                    )
                try {
                    redis.opsForValue().set(cacheKey, objectMapper.writeValueAsString(cacheDoc), Duration.ofSeconds(ttl))
                } catch (_: Exception) {
                    /* non-fatal */
                }
            }
        }
        return resolved
    }

    /**
     * Spot quote via Yahoo v8 `finance/chart` (v7 `finance/quote` often returns Unauthorized without crumb).
     */
    fun fetchEquityQuoteFromChart(symbol: String): Map<String, Any?>? {
        val sym = symbol.trim().uppercase()
        if (sym.isEmpty()) {
            return null
        }
        val url = "https://query1.finance.yahoo.com/v8/finance/chart/$sym?interval=1d&range=1d"
        val body = fetchQuoteHttp(url) ?: return null
        return try {
            val meta = objectMapper.readTree(body).path("chart").path("result").get(0)?.path("meta") ?: return null
            val price =
                meta.path("regularMarketPrice").asDouble(Double.NaN).takeIf { it.isFinite() && it > 0 }
                    ?: return null
            val prev =
                meta.path("chartPreviousClose").asDouble(Double.NaN).takeIf { it.isFinite() && it > 0 }
                    ?: meta.path("previousClose").asDouble(Double.NaN).takeIf { it.isFinite() && it > 0 }
            val change =
                if (prev != null) {
                    price - prev
                } else {
                    null
                }
            val changePct =
                if (prev != null && prev > 0 && change != null) {
                    (change / prev) * 100.0
                } else {
                    null
                }
            mapOf(
                "symbol" to meta.path("symbol").asText(sym),
                "shortName" to meta.path("shortName").asText(""),
                "regularMarketPrice" to price,
                "regularMarketPreviousClose" to prev,
                "regularMarketChange" to change,
                "regularMarketChangePercent" to changePct,
                "currency" to meta.path("currency").asText("USD"),
                "source" to "yahoo-finance2",
            )
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Batch spot quotes (chart API per symbol — aligns with Next `yahoo-finance2` reliability).
     */
    fun fetchEquityQuoteBatch(symbols: Collection<String>): Map<String, Map<String, Any?>> {
        val uniq =
            symbols
                .map { it.trim().uppercase() }
                .filter { it.isNotEmpty() }
                .distinct()
        if (uniq.isEmpty()) {
            return emptyMap()
        }
        val out = LinkedHashMap<String, Map<String, Any?>>()
        for (sym in uniq) {
            fetchEquityQuoteFromChart(sym)?.let { out[sym] = it }
        }
        return out
    }

    private fun fetchQuoteHttp(url: String): String? {
        val now = System.nanoTime()
        if (now < yahooBreakerOpenUntilNanos) {
            return null
        }
        val req =
            HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(20))
                .header("User-Agent", userAgent)
                .GET()
                .build()
        val t0 = System.nanoTime()
        val resp =
            try {
                client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
            } catch (_: Exception) {
                recordYahooBreakerFailure()
                return null
            }
        val elapsedMs = (System.nanoTime() - t0) / 1_000_000L
        if (elapsedMs > 12_000L) {
            recordYahooBreakerFailure()
        } else {
            yahooBreakerFailures.set(0)
        }
        if (resp.statusCode() !in 200..299) {
            recordYahooBreakerFailure()
            return null
        }
        return resp.body()
    }

    /** Spot quote for an equity underlying (uses options chain endpoint quote array). */
    fun fetchUnderlyingQuote(underlying: String): Map<String, Any?>? {
        val u = underlying.trim().uppercase()
        if (u.isEmpty()) {
            return null
        }
        val root = fetchOptionsJson(u, null) ?: return null
        val q = firstResult(root)?.path("quote")?.get(0) ?: return null
        return mapOf(
            "symbol" to q.path("symbol").asText(u),
            "regularMarketPrice" to q.path("regularMarketPrice").asDouble(0.0),
            "postMarketPrice" to q.path("postMarketPrice").asDouble(0.0),
            "preMarketPrice" to q.path("preMarketPrice").asDouble(0.0),
            "regularMarketPreviousClose" to q.path("regularMarketPreviousClose").asDouble(0.0),
            "regularMarketChange" to q.path("regularMarketChange").asDouble(0.0),
            "regularMarketChangePercent" to q.path("regularMarketChangePercent").asDouble(0.0),
            "currency" to q.path("currency").asText(""),
            "regularMarketTime" to q.path("regularMarketTime").asLong(0L),
        )
    }

    companion object {
        fun expirationDatesFromYahoo(root: JsonNode): List<String> {
            val dates = root.path("optionChain").path("result").get(0)?.path("expirationDates") ?: return emptyList()
            val out = ArrayList<String>()
            for (n in dates) {
                val sec = n.asLong(0L)
                if (sec <= 0L) continue
                val d = Instant.ofEpochSecond(sec).atZone(ZoneOffset.UTC).toLocalDate()
                out.add(d.format(DateTimeFormatter.ISO_LOCAL_DATE))
            }
            return out
        }

        fun firstResult(root: JsonNode): JsonNode? {
            val arr = root.path("optionChain").path("result")
            if (!arr.isArray || arr.size() == 0) {
                return null
            }
            return arr.get(0)
        }
    }
}
