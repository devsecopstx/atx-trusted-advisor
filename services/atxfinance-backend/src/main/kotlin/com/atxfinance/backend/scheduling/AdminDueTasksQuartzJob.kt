package com.atxfinance.backend.scheduling

import org.quartz.DisallowConcurrentExecution
import org.quartz.JobExecutionContext
import org.springframework.scheduling.quartz.QuartzJobBean
import org.springframework.stereotype.Component

/**
 * Quartz-native repeating job: each fire lists due rows in Mongo and runs them (often via Next delegate).
 * Trigger interval comes from [com.atxfinance.backend.config.AtxfinanceProperties.scheduler.pollIntervalMs].
 */
@Component
@DisallowConcurrentExecution
class AdminDueTasksQuartzJob(
    private val bridge: AdminSchedulerQuartzBridge,
) : QuartzJobBean() {
    override fun executeInternal(context: JobExecutionContext) {
        bridge.pollDueMongoTasks()
    }
}
