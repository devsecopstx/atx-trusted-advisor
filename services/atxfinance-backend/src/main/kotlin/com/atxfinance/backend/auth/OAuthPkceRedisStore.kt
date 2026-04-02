package com.atxfinance.backend.auth

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.config.RedisEnabledCondition
import org.springframework.context.annotation.Conditional
import org.springframework.stereotype.Service
import java.time.Duration

/**
 * PLAN 600 — OAuth PKCE verifier keyed by `state` (Spring target contract: Redis, ~10m TTL).
 * Callback may consume this when cookies are missing (e.g. cross-device testing).
 */
@Service
@Conditional(RedisEnabledCondition::class)
class OAuthPkceRedisStore(
    private val redis: org.springframework.data.redis.core.StringRedisTemplate,
    private val props: AtxfinanceProperties,
) {
    fun save(state: String, codeVerifier: String) {
        val key = key(state)
        val ttl = Duration.ofSeconds(props.redis.pkceTtlSeconds.coerceIn(60, 3600))
        redis.opsForValue().set(key, codeVerifier, ttl)
    }

    /** One-time read: removes the key if present (mitigates code replay). */
    fun consumeVerifier(state: String): String? {
        val key = key(state)
        val v = redis.opsForValue().get(key)
        if (v != null) {
            redis.delete(key)
        }
        return v
    }

    private fun key(state: String): String = "xf:oauth:pkce:${state.trim()}"
}
