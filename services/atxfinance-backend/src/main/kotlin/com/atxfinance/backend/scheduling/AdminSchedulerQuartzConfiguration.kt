package com.atxfinance.backend.scheduling

import com.atxfinance.backend.config.AtxfinanceProperties
import org.quartz.JobBuilder
import org.quartz.JobDetail
import org.quartz.SimpleScheduleBuilder
import org.quartz.Trigger
import org.quartz.TriggerBuilder
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Conditional
import org.springframework.context.annotation.Configuration
import org.springframework.boot.autoconfigure.quartz.SchedulerFactoryBeanCustomizer

/**
 * Quartz RAM job-store + simple repeating trigger for Mongo-backed admin tasks.
 * Per-task **cron** remains on each `admin_scheduled_tasks` document (`scheduleCron` / `nextRunAt`); Quartz only
 * drives **when** we scan for due rows (same cadence as legacy `@Scheduled` poller).
 */
@Configuration
@Conditional(SchedulerQuartzDriverCondition::class)
class AdminSchedulerQuartzConfiguration(
    private val props: AtxfinanceProperties,
) {
    @Bean
    fun atxfinanceSchedulerQuartzJobFactory(applicationContext: ApplicationContext): ContextAwareSpringBeanJobFactory =
        ContextAwareSpringBeanJobFactory(applicationContext)

    @Bean
    fun atxfinanceSchedulerQuartzJobFactoryCustomizer(
        jobFactory: ContextAwareSpringBeanJobFactory,
    ): SchedulerFactoryBeanCustomizer =
        SchedulerFactoryBeanCustomizer { factory -> factory.setJobFactory(jobFactory) }

    @Bean
    fun atxfinanceAdminDueTasksPollJobDetail(): JobDetail =
        JobBuilder.newJob(AdminDueTasksQuartzJob::class.java)
            .withIdentity("adminDueTasksPoll", "atxfinance")
            .storeDurably()
            .build()

    @Bean
    fun atxfinanceAdminDueTasksPollTrigger(jobDetail: JobDetail): Trigger {
        val interval = props.scheduler.pollIntervalMs.coerceIn(5_000L, 3_600_000L)
        return TriggerBuilder.newTrigger()
            .forJob(jobDetail)
            .withIdentity("adminDueTasksPollTrigger", "atxfinance")
            .withSchedule(
                SimpleScheduleBuilder.simpleSchedule()
                    .withIntervalInMilliseconds(interval)
                    .repeatForever(),
            )
            .build()
    }
}
