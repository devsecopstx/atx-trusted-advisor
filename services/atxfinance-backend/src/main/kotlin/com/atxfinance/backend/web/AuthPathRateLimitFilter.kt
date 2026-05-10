package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.config.RedisEnabledCondition
import jakarta.servlet.Filter
import jakarta.servlet.FilterChain
import jakarta.servlet.ServletRequest
import jakarta.servlet.ServletResponse
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.annotation.Conditional
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration

/**
 * PLAN 600 — rolling per-minute limits for OAuth endpoints (Memorystore-backed).
 * When Redis is off, this filter is not registered (no in-process fallback).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@Conditional(RedisEnabledCondition::class)
class AuthPathRateLimitFilter(
    @Qualifier("controlRedisTemplate")
    private val redis: StringRedisTemplate,
    private val props: AtxfinanceProperties,
) : Filter {
    override fun doFilter(request: ServletRequest, response: ServletResponse, chain: FilterChain) {
        val req = request as HttpServletRequest
        val res = response as HttpServletResponse
        val uri = req.requestURI ?: ""
        val limit =
            when {
                uri.contains("/api/auth/x/login") -> props.redis.authLoginLimitPerMinute
                uri.contains("/api/auth/x/callback") -> props.redis.authCallbackLimitPerMinute
                else -> {
                    chain.doFilter(request, response)
                    return
                }
            }
        if (limit <= 0) {
            chain.doFilter(request, response)
            return
        }
        val ip = clientIp(req)
        val kind = if (uri.contains("/login")) "login" else "cb"
        val bucket = System.currentTimeMillis() / 60_000L
        val key = "xf:rl:auth:$kind:$ip:$bucket"
        val n = try {
            val next = redis.opsForValue().increment(key) ?: 1L
            if (next == 1L) {
                redis.expire(key, Duration.ofMinutes(2))
            }
            next
        } catch (_: Exception) {
            chain.doFilter(request, response)
            return
        }
        if (n > limit) {
            res.status = 429
            res.contentType = "application/json"
            res.characterEncoding = "UTF-8"
            res.writer.write("""{"error":"rate_limited","message":"Too many OAuth requests"}""")
            return
        }
        chain.doFilter(request, response)
    }

    private fun clientIp(req: HttpServletRequest): String {
        val fwd = req.getHeader("X-Forwarded-For")?.split(",")?.firstOrNull()?.trim()
        if (!fwd.isNullOrEmpty()) {
            return fwd.take(64)
        }
        return req.remoteAddr?.trim()?.take(64) ?: "unknown"
    }
}
