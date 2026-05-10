package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.config.RedisEnabledCondition
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.annotation.Conditional
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * PLAN 600 — optional Redis hourly counter for strategy jobs when Memorystore is enabled.
 * Mongo remains source of truth for idempotency and listing; this is a fast fuse aligned with [AtxfinanceProperties.strategyMaxJobsHourly].
 */
@Component
@Conditional(RedisEnabledCondition::class)
class StrategyJobRedisQuota(
    @Qualifier("controlRedisTemplate")
    private val redis: StringRedisTemplate,
    private val props: AtxfinanceProperties,
) {
    private val hourFmt = DateTimeFormatter.ofPattern("yyyyMMddHH").withZone(ZoneOffset.UTC)

    /**
     * @return jobs in current UTC hour after this reservation, or null if over limit (counter rolled back).
     * Key scope matches Mongo hourly count: tenant + user + normalized emailAccountId (Phase 1 isolation).
     */
    fun tryReserveSlot(tenantId: String, userId: String, emailAccountId: String): Long? {
        val key = redisKey(tenantId, userId, emailAccountId)
        val n = redis.opsForValue().increment(key) ?: return null
        if (n == 1L) {
            redis.expire(key, Duration.ofHours(2))
        }
        if (n > props.strategyMaxJobsHourly) {
            redis.opsForValue().decrement(key)
            return null
        }
        return n
    }

    fun releaseSlot(tenantId: String, userId: String, emailAccountId: String) {
        val key = redisKey(tenantId, userId, emailAccountId)
        redis.opsForValue().decrement(key)
    }

    private fun redisKey(tenantId: String, userId: String, emailAccountId: String): String {
        val hour = hourFmt.format(Instant.now())
        val idem = sha256Hex16("${tenantId.trim()}\u0000${userId.trim()}\u0000${emailAccountId.trim()}")
        return "xf:sj:hourly:${tenantId.trim()}:${userId.trim()}:$idem:$hour"
    }

    private fun sha256Hex16(s: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        val hex = md.digest(s.toByteArray(StandardCharsets.UTF_8)).joinToString("") { b -> "%02x".format(b) }
        return hex.take(16)
    }
}
