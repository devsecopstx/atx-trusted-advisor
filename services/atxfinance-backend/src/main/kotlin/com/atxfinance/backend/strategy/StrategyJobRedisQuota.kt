package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.config.RedisEnabledCondition
import org.springframework.context.annotation.Conditional
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
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
    private val redis: StringRedisTemplate,
    private val props: AtxfinanceProperties,
) {
    private val hourFmt = DateTimeFormatter.ofPattern("yyyyMMddHH").withZone(ZoneOffset.UTC)

    /** @return jobs in current UTC hour after this reservation, or null if over limit (counter rolled back). */
    fun tryReserveSlot(userId: String): Long? {
        val key = redisKey(userId)
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

    fun releaseSlot(userId: String) {
        val key = redisKey(userId)
        redis.opsForValue().decrement(key)
    }

    private fun redisKey(userId: String): String {
        val hour = hourFmt.format(Instant.now())
        return "xf:sj:hourly:${userId.trim()}:$hour"
    }
}
