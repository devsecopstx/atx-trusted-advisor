package com.atxfinance.backend.pubsub

import com.google.api.gax.core.CredentialsProvider
import com.google.api.gax.core.NoCredentialsProvider
import com.google.cloud.pubsub.v1.Publisher
import com.google.pubsub.v1.ProjectTopicName
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
@EnableConfigurationProperties(PubSubProps::class)
class PubSubConfig {
    private val log = LoggerFactory.getLogger(javaClass)

    @Bean
    fun credentialsProvider(): CredentialsProvider {
        // Rely on default application credentials if present; otherwise no-credentials (local no-op/stub)
        return NoCredentialsProvider.create()
    }

    @Bean(destroyMethod = "shutdown")
    @ConditionalOnProperty(prefix = "app.pubsub", name = ["project-id", "topic"], matchIfMissing = false)
    fun publisher(props: PubSubProps, credentialsProvider: CredentialsProvider): Publisher {
        val topicName = ProjectTopicName.of(props.projectId!!, props.topic!!)
        log.info("Configuring Pub/Sub publisher for topic={}", topicName)
        return Publisher.newBuilder(topicName).setCredentialsProvider(credentialsProvider).build()
    }
}

@ConfigurationProperties(prefix = "app.pubsub")
class PubSubProps {
    var projectId: String? = null
    var topic: String? = null
    var dlqTopic: String? = null
}