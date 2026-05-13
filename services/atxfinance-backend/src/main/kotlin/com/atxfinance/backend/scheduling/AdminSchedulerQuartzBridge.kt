package com.atxfinance.backend.scheduling

import com.atxfinance.backend.admin.AdminScheduledTasksService
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component
import java.util.Date

/**
 * ShedLock-guarded entry point invoked by [AdminDueTasksQuartzJob] so multi-replica Quartz does not double-poll Mongo.
 */
@Component
class AdminSchedulerQuartzBridge(
    private val adminScheduledTasksService: AdminScheduledTasksService,
    private val schedulerPollTelemetry: SchedulerPollTelemetry,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @SchedulerLock(name = "adminScheduledTasksSystemPoll", lockAtMostFor = "PT3M", lockAtLeastFor = "PT5S")
    fun pollDueMongoTasks() {
        schedulerPollTelemetry.recordPollStarted()
        try {
            val accepted = adminScheduledTasksService.enqueueDueTasksForSystemPoll(Date())
            schedulerPollTelemetry.recordPollSuccess(accepted.size)
            if (accepted.isNotEmpty()) {
                log.info(
                    "[admin/scheduler] {} enqueued {} task(s)",
                    AdminScheduledTasksService.SYSTEM_SCHEDULER_TRIGGER,
                    accepted.size,
                )
            }
        } catch (t: Throwable) {
            schedulerPollTelemetry.recordPollFailure(t)
            log.error("[admin/scheduler] quartz poll failed", t)
            throw t
        }
    }
}
