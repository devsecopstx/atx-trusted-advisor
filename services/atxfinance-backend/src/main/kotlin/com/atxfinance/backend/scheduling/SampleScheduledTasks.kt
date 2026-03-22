package com.atxfinance.backend.scheduling

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.concurrent.atomic.AtomicLong

@Component
class SampleScheduledTasks(
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val counter = AtomicLong(0)

    // Demonstration heartbeat. In real code, register thousands of tasks dynamically via DB configs.
    @Scheduled(fixedDelayString = "PT30S")
    @SchedulerLock(name = "heartbeatTask", lockAtMostFor = "PT1M")
    fun heartbeat() {
        val c = counter.incrementAndGet()
        log.info("heartbeat run={} at={} ", c, Instant.now())
    }
}