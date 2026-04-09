package com.atxfinance.backend.config

import net.javacrumbs.shedlock.core.LockProvider
import net.javacrumbs.shedlock.provider.mongo.MongoLockProvider
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.task.TaskExecutor
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor

@Configuration
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "PT5M")
class SchedulingConfig {
    @Bean
    fun lockProvider(mongoTemplate: MongoTemplate): LockProvider {
        // Same DB as Spring Data (from MONGODB_URI path / MONGODB_DB_NAME). Never use `admin`:
        // Atlas app users are not authorized for findAndModify on app collections there.
        return MongoLockProvider(mongoTemplate.db)
    }

    @Bean(name = ["schedulerTaskExecutor"])
    fun schedulerTaskExecutor(): TaskExecutor {
        val exec = ThreadPoolTaskExecutor()
        exec.corePoolSize = 4
        exec.maxPoolSize = 4
        exec.setThreadNamePrefix("scheduler-")
        exec.initialize()
        return exec
    }
}