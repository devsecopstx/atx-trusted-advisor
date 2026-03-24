package com.atxfinance.backend.config

import org.springframework.boot.SpringApplication
import org.springframework.boot.env.EnvironmentPostProcessor
import org.springframework.core.Ordered
import org.springframework.core.env.ConfigurableEnvironment
import org.springframework.core.env.MapPropertySource

/**
 * If `MONGODB_URI` (or legacy `MONGODB_URI_B64`) is set, resolves it to a real Mongo URI
 * (plain `mongodb://` / `mongodb+srv://`, or base64-encoded) and injects `spring.data.mongodb.uri`
 * with highest precedence.
 */
class MongoUriEnvPostProcessor : EnvironmentPostProcessor, Ordered {
    override fun postProcessEnvironment(environment: ConfigurableEnvironment, application: SpringApplication) {
        val fromSpringUri = environment.getProperty("MONGODB_URI")?.trim()?.takeIf { it.isNotEmpty() }
        val fromSystemUri = System.getenv("MONGODB_URI")?.trim()?.takeIf { it.isNotEmpty() }
        val legacyB64 =
            environment.getProperty("MONGODB_URI_B64")?.trim()?.takeIf { it.isNotEmpty() }
                ?: System.getenv("MONGODB_URI_B64")?.trim()?.takeIf { it.isNotEmpty() }
        val raw = fromSpringUri ?: fromSystemUri ?: legacyB64 ?: return
        val resolved = MongoUriResolver.resolve(raw)

        val props = mapOf(
            "spring.data.mongodb.uri" to resolved,
            "SPRING_DATA_MONGODB_URI" to resolved,
            "MONGODB_URI" to resolved
        )
        val source = MapPropertySource("mongoUriOverride", props)
        environment.propertySources.addFirst(source)
    }

    // Ensure it runs quite early but after system environment; lower value = higher precedence for Ordered
    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE
}
