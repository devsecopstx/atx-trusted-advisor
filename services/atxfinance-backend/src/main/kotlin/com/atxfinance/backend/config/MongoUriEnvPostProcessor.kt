package com.atxfinance.backend.config

import org.springframework.boot.SpringApplication
import org.springframework.boot.env.EnvironmentPostProcessor
import org.springframework.core.Ordered
import org.springframework.core.env.ConfigurableEnvironment
import org.springframework.core.env.MapPropertySource
import java.util.Base64

/**
 * Environment post-processor that, if the environment variable `MONGODB_URI_B64` is present,
 * decodes it from Base64 and injects it as `spring.data.mongodb.uri` with high precedence.
 *
 * This allows deployments to provide a single base64-encoded Mongo connection string
 * (e.g. for cloud providers) while keeping local/docker defaults intact.
 */
class MongoUriEnvPostProcessor : EnvironmentPostProcessor, Ordered {
    override fun postProcessEnvironment(environment: ConfigurableEnvironment, application: SpringApplication) {
        // Prefer Spring Environment property (testable and supports custom property sources),
        // fall back to system environment if not present.
        val fromSpring = environment.getProperty("MONGODB_URI_B64")?.trim()?.takeIf { it.isNotEmpty() }
        val fromSystem = System.getenv("MONGODB_URI_B64")?.trim()?.takeIf { it.isNotEmpty() }
        val b64 = fromSpring ?: fromSystem
        if (!b64.isNullOrEmpty()) {
            val decoded = try {
                // Try standard Base64 first; if it fails, attempt URL-safe variant
                String(Base64.getDecoder().decode(b64))
            } catch (e: IllegalArgumentException) {
                String(Base64.getUrlDecoder().decode(b64))
            }

            val props = mapOf(
                // Set the canonical Spring Boot property directly at the highest precedence we control
                "spring.data.mongodb.uri" to decoded,
                // Also provide env-style aliases many setups look for
                "SPRING_DATA_MONGODB_URI" to decoded,
                "MONGODB_URI" to decoded
            )
            val source = MapPropertySource("mongoUriB64Override", props)
            // Add as the very first property source to win over others
            environment.propertySources.addFirst(source)
        }
    }

    // Ensure it runs quite early but after system environment; lower value = higher precedence for Ordered
    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE
}
