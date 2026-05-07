package com.atxfinance.backend.portfolio

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.ObjectProvider
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import java.time.Duration
import java.time.Instant

/**
 * Redis-backed read-through cache for materialized workspace preload rows (`portfolio_workspace_snapshots`),
 * using the **same key layout as Next** (`xf:wsnap:v1:…`) so Memorystore can be shared safely across services.
 *
 * TTL: shorter when [UsEquitiesRegularSession] reports likely open, longer when likely closed — see
 * [com.atxfinance.backend.config.RedisProps.portfolioSnapshotTtlOpenSeconds] / `…ClosedSeconds`.
 *
 * **`GET /api/portfolios/{id}/snapshot`** adds denormalized **`structured`** (see [PortfolioStructuredSummary])
 * for holdings summary, balances, and watchlist quote strip — canonical fast-path for xChat preload + find-options
 * when BFF + Redis are enabled; Next materializes Mongo rows and falls back when **`ATXFINANCE_BACKEND_ORIGIN`** is unset.
 */
@Service
class PortfolioSnapshotService(
    private val redisProvider: ObjectProvider<StringRedisTemplate>,
    private val workspaceSnapshotService: PortfolioWorkspaceSnapshotService,
    private val props: AtxfinanceProperties,
    private val objectMapper: ObjectMapper,
) {
    fun buildWorkspaceSnapshotCacheKey(
        session: ResolvedSession,
        portfolioIdHex: String,
        workspaceContentRev: Int,
    ): String {
        val t = session.tenantId.trim().ifEmpty { "_" }
        return "xf:wsnap:v1:$t:${session.userId.trim()}:$portfolioIdHex:$workspaceContentRev"
    }

    fun resolveSnapshotTtlSeconds(now: Instant): Long {
        val open = UsEquitiesRegularSession.isRegularSessionLikelyOpen(now)
        return if (open) {
            props.redis.portfolioSnapshotTtlOpenSeconds
        } else {
            props.redis.portfolioSnapshotTtlClosedSeconds
        }.coerceIn(15L, 3600L)
    }

    /**
     * Returns workspace snapshot payload + cache diagnostics, or **null** when Mongo has no matching row.
     */
    fun getCachedWorkspaceSnapshot(
        portfolioIdHex: String,
        workspaceContentRev: Int,
        session: ResolvedSession,
    ): Pair<Map<String, Any?>, Map<String, Any?>>? {
        val redis = redisProvider.ifAvailable
        val key = buildWorkspaceSnapshotCacheKey(session, portfolioIdHex, workspaceContentRev)
        val now = Instant.now()
        val ttl = resolveSnapshotTtlSeconds(now)
        val marketWindow = if (UsEquitiesRegularSession.isRegularSessionLikelyOpen(now)) "open" else "closed"

        if (redis != null) {
            try {
                val cached = redis.opsForValue().get(key)
                if (!cached.isNullOrBlank()) {
                    val payload =
                        objectMapper.readValue(cached, object : TypeReference<Map<String, Any?>>() {})
                    val cacheMeta =
                        mapOf(
                            "redis" to "hit",
                            "ttlSeconds" to ttl,
                            "marketWindow" to marketWindow,
                        )
                    return payload to cacheMeta
                }
            } catch (_: Exception) {
                /* fall through to Mongo */
            }
        }

        val mongoPayload =
            workspaceSnapshotService.findSnapshotForSessionUser(portfolioIdHex, workspaceContentRev, session)
                ?: return null

        if (redis != null) {
            try {
                val json = objectMapper.writeValueAsString(mongoPayload)
                redis.opsForValue().set(key, json, Duration.ofSeconds(ttl))
            } catch (_: Exception) {
                /* ignore cache write failures */
            }
        }

        val cacheMeta =
            mapOf(
                "redis" to if (redis != null) "miss" else "skipped",
                "ttlSeconds" to ttl,
                "marketWindow" to marketWindow,
            )
        return mongoPayload to cacheMeta
    }

    /** Purge cached workspace snapshot JSON for this user + portfolio (all revs). */
    fun invalidateWorkspaceSnapshotCache(
        session: ResolvedSession,
        portfolioIdHex: String,
    ) {
        val redis = redisProvider.ifAvailable ?: return
        val t = session.tenantId.trim().ifEmpty { "_" }
        val pattern = "xf:wsnap:v1:$t:${session.userId.trim()}:$portfolioIdHex:*"
        try {
            val keys = redis.keys(pattern)
            if (keys.isNotEmpty()) {
                redis.delete(keys)
            }
        } catch (_: Exception) {
            /* non-fatal */
        }
    }
}
