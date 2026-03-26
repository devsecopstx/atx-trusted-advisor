package com.atxfinance.backend.config

import com.mongodb.client.MongoClient
import net.javacrumbs.shedlock.core.LockProvider
import net.javacrumbs.shedlock.provider.mongo.MongoLockProvider
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.task.TaskExecutor
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor

@Configuration
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "PT5M")
class SchedulingConfig {
    @Bean
    fun lockProvider(mongoClient: MongoClient): LockProvider {
        // Use default database from Spring's Mongo properties; ShedLock creates a 'shedLock' collection by default
        return MongoLockProvider(mongoClient.getDatabase(getDefaultDbName(mongoClient)))
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

    private fun getDefaultDbName(mongoClient: MongoClient): String {
        // Try to read default database from connection string if available; fallback
        // Many drivers expose it via MongoClientSettings, but to keep simple and dependency‑free,
        // use a conventional name if unknown.
        return try {
            val dbs = mongoClient.listDatabaseNames().into(mutableListOf())
            // Prefer 'admin' if exists, else first, else 'admin'
            when {
                dbs.contains("admin") -> "admin"
                dbs.isNotEmpty() -> dbs.first()
                else -> "admin"
            }
        } catch (e: Exception) {
            "admin"
        }
    }
}