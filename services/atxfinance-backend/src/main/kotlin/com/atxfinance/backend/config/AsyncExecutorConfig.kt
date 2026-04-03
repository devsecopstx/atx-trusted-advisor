package com.atxfinance.backend.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.EnableAsync
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor
import java.util.concurrent.Executor

@Configuration
@EnableAsync
class AsyncExecutorConfig {
    @Bean(name = ["strategyFinalizerExecutor"])
    fun strategyFinalizerExecutor(): Executor {
        val exec = ThreadPoolTaskExecutor()
        exec.corePoolSize = 2
        exec.maxPoolSize = 4
        exec.setQueueCapacity(200)
        exec.setThreadNamePrefix("strategy-finalizer-")
        exec.initialize()
        return exec
    }
}
