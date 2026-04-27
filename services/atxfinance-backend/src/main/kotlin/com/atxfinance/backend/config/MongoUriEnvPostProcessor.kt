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
        val tuned = applyDefaultMongoClientOptions(resolved, environment)

        val props = mapOf(
            "spring.data.mongodb.uri" to tuned,
            "SPRING_DATA_MONGODB_URI" to tuned,
            "MONGODB_URI" to tuned
        )
        val source = MapPropertySource("mongoUriOverride", props)
        environment.propertySources.addFirst(source)
    }

    // Ensure it runs quite early but after system environment; lower value = higher precedence for Ordered
    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE

    private fun applyDefaultMongoClientOptions(
        uri: String,
        environment: ConfigurableEnvironment
    ): String {
        val queryStart = uri.indexOf('?')
        val base = if (queryStart >= 0) uri.substring(0, queryStart) else uri
        val currentQuery = if (queryStart >= 0) uri.substring(queryStart + 1) else ""
        val currentParams =
            currentQuery
                .split("&")
                .asSequence()
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .toList()

        val existingKeys =
            currentParams
                .asSequence()
                .mapNotNull { token ->
                    val idx = token.indexOf('=')
                    when {
                        idx > 0 -> token.substring(0, idx).trim().lowercase()
                        token.isNotEmpty() -> token.lowercase()
                        else -> null
                    }
                }
                .toSet()

        val defaults =
            listOfNotNull(
                envMongoOption("MONGODB_CONNECT_TIMEOUT_MS", "connectTimeoutMS", "15000", environment),
                envMongoOption("MONGODB_SOCKET_TIMEOUT_MS", "socketTimeoutMS", "120000", environment),
                envMongoOption(
                    "MONGODB_SERVER_SELECTION_TIMEOUT_MS",
                    "serverSelectionTimeoutMS",
                    "20000",
                    environment
                ),
                envMongoOption("MONGODB_WAIT_QUEUE_TIMEOUT_MS", "waitQueueTimeoutMS", "15000", environment),
                envMongoOption("MONGODB_MAX_IDLE_TIME_MS", "maxIdleTimeMS", "120000", environment),
                envMongoOption("MONGODB_RETRY_READS", "retryReads", "true", environment),
                envMongoOption("MONGODB_RETRY_WRITES", "retryWrites", "true", environment),
            )

        val merged = currentParams.toMutableList()
        for ((key, value) in defaults) {
            if (!existingKeys.contains(key.lowercase())) {
                merged.add("$key=$value")
            }
        }

        if (merged.isEmpty()) {
            return base
        }
        return "$base?${merged.joinToString("&")}"
    }

    private fun envMongoOption(
        envKey: String,
        optionKey: String,
        fallback: String,
        environment: ConfigurableEnvironment
    ): Pair<String, String>? {
        val explicit =
            environment.getProperty(envKey)?.trim()?.takeIf { it.isNotEmpty() }
                ?: System.getenv(envKey)?.trim()?.takeIf { it.isNotEmpty() }
        val value = explicit ?: fallback
        return if (value.isBlank()) null else optionKey to value
    }
}
