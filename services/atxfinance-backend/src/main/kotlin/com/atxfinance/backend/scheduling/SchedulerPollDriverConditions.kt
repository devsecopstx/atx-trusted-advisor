package com.atxfinance.backend.scheduling

import org.springframework.boot.autoconfigure.condition.ConditionOutcome
import org.springframework.boot.autoconfigure.condition.SpringBootCondition
import org.springframework.context.annotation.ConditionContext
import org.springframework.core.type.AnnotatedTypeMetadata

/** `@Scheduled` poller — enabled and `driver=simple`. */
class SchedulerSimplePollerCondition : SpringBootCondition() {
    override fun getMatchOutcome(context: ConditionContext, metadata: AnnotatedTypeMetadata): ConditionOutcome {
        val env = context.environment
        val enabled = env.getProperty("app.atxfinance.scheduler.enabled")?.lowercase() ?: "true"
        if (enabled == "false") {
            return ConditionOutcome.noMatch("app.atxfinance.scheduler.enabled=false")
        }
        val driver = env.getProperty("app.atxfinance.scheduler.driver") ?: "quartz"
        return if (driver == "simple") {
            ConditionOutcome.match("driver=simple")
        } else {
            ConditionOutcome.noMatch("driver is not simple")
        }
    }
}

/** Quartz poll driver — enabled and `driver=quartz` (default). */
class SchedulerQuartzDriverCondition : SpringBootCondition() {
    override fun getMatchOutcome(context: ConditionContext, metadata: AnnotatedTypeMetadata): ConditionOutcome {
        val env = context.environment
        val enabled = env.getProperty("app.atxfinance.scheduler.enabled")?.lowercase() ?: "true"
        if (enabled == "false") {
            return ConditionOutcome.noMatch("app.atxfinance.scheduler.enabled=false")
        }
        val driver = env.getProperty("app.atxfinance.scheduler.driver") ?: "quartz"
        return if (driver == "quartz") {
            ConditionOutcome.match("driver=quartz")
        } else {
            ConditionOutcome.noMatch("driver is not quartz")
        }
    }
}
