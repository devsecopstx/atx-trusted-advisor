package com.atxfinance.backend.config

import org.springframework.context.annotation.Condition
import org.springframework.context.annotation.ConditionContext
import org.springframework.core.type.AnnotatedTypeMetadata

/** True when a Redis URL is configured (Memorystore / Redis Cloud / local). */
class RedisEnabledCondition : Condition {
    override fun matches(context: ConditionContext, metadata: AnnotatedTypeMetadata): Boolean {
        val env = context.environment
        val candidates =
            listOf(
                env.getProperty("REDIS_URL"),
                env.getProperty("SPRING_DATA_REDIS_URL"),
                env.getProperty("app.atxfinance.redis.url"),
            )
        val u = candidates.firstOrNull { !it.isNullOrBlank() }?.trim() ?: return false
        return u.startsWith("redis://") || u.startsWith("rediss://")
    }
}
