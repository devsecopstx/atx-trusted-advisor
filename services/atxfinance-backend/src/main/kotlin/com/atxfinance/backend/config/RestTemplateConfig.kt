package com.atxfinance.backend.config

import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.web.client.RestTemplateBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Primary
import org.springframework.web.client.RestTemplate
import java.time.Duration

@Configuration
class RestTemplateConfig {
    @Bean
    @Primary
    fun restTemplate(builder: RestTemplateBuilder): RestTemplate = builder.build()

    /** Long read timeout for Next `execute-task` (watchlist / options scanners can run minutes). */
    @Bean
    @Qualifier("schedulerDelegateRestTemplate")
    fun schedulerDelegateRestTemplate(builder: RestTemplateBuilder): RestTemplate =
        builder
            .setConnectTimeout(Duration.ofSeconds(20))
            .setReadTimeout(Duration.ofMinutes(15))
            .build()
}
