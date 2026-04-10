package com.atxfinance.backend.scheduling

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.concurrent.atomic.AtomicLong

@Component
@ConditionalOnProperty(
    name = ["app.atxfinance.scheduler.demo-heartbeat-enabled"],
    havingValue = "true",
    matchIfMissing = true,
)
class SampleScheduledTasks(
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val counter = AtomicLong(0)

    // Demonstration heartbeat (ShedLock + scheduler wiring). Not for prod log noise — use DEBUG when validating scheduling.
    @Scheduled(fixedDelayString = "PT30S")
    @SchedulerLock(name = "heartbeatTask", lockAtMostFor = "PT1M")
    fun heartbeat() {
        val c = counter.incrementAndGet()
        log.debug("heartbeat run={} at={}", c, Instant.now())
    }
}