package com.atxfinance.backend.xchat

import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.web.client.RestTemplateBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.client.RestTemplate
import java.time.Duration

@Configuration
class XaiResponsesClientConfig {
  @Bean
  @Qualifier("xaiResponsesRestTemplate")
  fun xaiResponsesRestTemplate(builder: RestTemplateBuilder): RestTemplate =
      builder
          .setConnectTimeout(Duration.ofSeconds(20))
          .setReadTimeout(Duration.ofMinutes(5))
          .build()
}
