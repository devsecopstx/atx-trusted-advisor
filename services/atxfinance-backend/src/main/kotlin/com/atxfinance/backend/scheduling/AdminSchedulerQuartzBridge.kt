package com.atxfinance.backend.scheduling

import com.atxfinance.backend.admin.AdminScheduledTasksService
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock
import org.springframework.stereotype.Component
import java.util.Date

/**
 * ShedLock-guarded entry point invoked by [AdminDueTasksQuartzJob] so multi-replica Quartz does not double-poll Mongo.
 */
@Component
class AdminSchedulerQuartzBridge(
    private val adminScheduledTasksService: AdminScheduledTasksService,
) {
    @SchedulerLock(name = "adminScheduledTasksSystemPoll", lockAtMostFor = "PT3M", lockAtLeastFor = "PT5S")
    fun pollDueMongoTasks() {
        adminScheduledTasksService.enqueueDueTasksForSystemPoll(Date())
    }
}
