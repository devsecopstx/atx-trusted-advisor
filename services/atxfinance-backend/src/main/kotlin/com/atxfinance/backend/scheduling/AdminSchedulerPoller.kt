package com.atxfinance.backend.scheduling

import com.atxfinance.backend.admin.AdminScheduledTasksService
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.util.Date

/**
 * Background poll for due [com.atxfinance.backend.config.AtxfinanceProperties.scheduledTasksCollection] rows.
 *
 * **Cloud Run:** If the service scales to **zero**, no poll runs until a request wakes an instance — set **min-instances ≥ 1**
 * on the backend (and optionally the Next service) so due jobs fire within ~[poll-interval-ms] without Vercel cron or
 * Cloud Scheduler hitting `POST /api/admin/scheduler/tick`.
 *
 * **Multi-instance:** This method is wrapped with **ShedLock** so only one replica executes a poll window at a time.
 * [AdminScheduledTasksService] also acquires a **per-task** Mongo lock before enqueueing, so the same job is not started
 * twice if ticks overlap or HTTP tick races the poller.
 *
 * **Execution threads:** The poller thread only lists due tasks and calls [AdminScheduledTasksService.enqueueDueTasksForSystemPoll];
 * heavy work runs on `schedulerTaskExecutor` inside [AdminScheduledTasksService.enqueueScheduledTask].
 */
@Component
@ConditionalOnProperty(
    name = ["app.atxfinance.scheduler.enabled"],
    havingValue = "true",
    matchIfMissing = true,
)
class AdminSchedulerPoller(
    private val adminScheduledTasksService: AdminScheduledTasksService,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(fixedRateString = "\${app.atxfinance.scheduler.poll-interval-ms:60000}")
    @SchedulerLock(
        name = "adminScheduledTasksSystemPoll",
        lockAtMostFor = "PT3M",
        lockAtLeastFor = "PT5S",
    )
    fun pollDueTasks() {
        val accepted = adminScheduledTasksService.enqueueDueTasksForSystemPoll(Date())
        if (accepted.isNotEmpty()) {
            log.info(
                "[admin/scheduler] {} enqueued {} task(s)",
                AdminScheduledTasksService.SYSTEM_SCHEDULER_TRIGGER,
                accepted.size,
            )
        }
    }
}
