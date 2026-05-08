package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.UsEquitiesRegularSession
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.ObjectProvider
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

@Component
class StrategyOptionsYahooClient(
    private val objectMapper: ObjectMapper,
    private val redisProvider: ObjectProvider<StringRedisTemplate>,
    private val propsProvider: ObjectProvider<AtxfinanceProperties>,
) {
    private val client: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(8))
        .build()

    private val userAgent =
        "Mozilla/5.0 (compatible; atxfinance-backend/1.0; +https://fintech-advisor.ai)"

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
        val resp = try {
            client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
        } catch (_: Exception) {
            return null
        }
        if (resp.statusCode() !in 200..299) {
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
