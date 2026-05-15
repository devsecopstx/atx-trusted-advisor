package com.atxfinance.backend.scheduling

import com.atxfinance.backend.config.AtxfinanceProperties
import org.springframework.stereotype.Component
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/**
 * In-memory last-run snapshot for JVM due-task polls ([AdminSchedulerPoller] / [AdminSchedulerQuartzBridge]).
 * Exposed on `GET /api/backend/health` so production can confirm the poller is alive without log diving.
 */
@Component
class SchedulerPollTelemetry(
    private val props: AtxfinanceProperties,
) {
    private val lastPollAt = AtomicReference<Instant?>(null)
    private val lastSuccessfulRun = AtomicReference<Instant?>(null)
    private val tasksEnqueuedLastPoll = AtomicInteger(0)
    private val lastError = AtomicReference<String?>(null)

    fun recordPollStarted() {
        lastPollAt.set(Instant.now())
    }

    fun recordPollSuccess(enqueuedCount: Int) {
        lastSuccessfulRun.set(Instant.now())
        tasksEnqueuedLastPoll.set(enqueuedCount.coerceAtLeast(0))
        lastError.set(null)
    }

    fun recordPollFailure(t: Throwable) {
        val msg = (t.message ?: t.javaClass.simpleName).take(MAX_ERROR_LEN)
        lastError.set(msg)
    }

    fun healthPayload(): Map<String, Any?> {
        val enabled = props.scheduler.enabled
        val intervalMs = props.scheduler.pollIntervalMs.coerceIn(5_000L, 3_600_000L)
        val driver = props.scheduler.driver.trim().lowercase().ifEmpty { "quartz" }
        if (!enabled) {
            return mapOf(
                "lastPollAt" to null,
                "lastSuccessfulRun" to null,
                "tasksEnqueuedLastPoll" to 0,
                "status" to "disabled",
                "driver" to driver,
                "pollIntervalMs" to intervalMs,
            )
        }
        val now = Instant.now()
        val pollAt = lastPollAt.get()
        val okAt = lastSuccessfulRun.get()
        val enqueued = tasksEnqueuedLastPoll.get()
        val err = lastError.get()
        val staleAfterMs = maxOf(intervalMs * 3, 120_000L)
        val ageMs = pollAt?.let { ChronoUnit.MILLIS.between(it, now).coerceAtLeast(0) }
        val status =
            when {
                pollAt == null -> "unknown"
                err != null -> "error"
                ageMs != null && ageMs > staleAfterMs -> "stale"
                else -> "healthy"
            }
        return mapOf(
            "lastPollAt" to (pollAt?.toString()),
            "lastSuccessfulRun" to (okAt?.toString()),
            "tasksEnqueuedLastPoll" to enqueued,
            "status" to status,
            "driver" to driver,
            "pollIntervalMs" to intervalMs,
            "lastError" to err,
        )
    }

    companion object {
        private const val MAX_ERROR_LEN = 500
    }
}
