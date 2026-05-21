package com.atxfinance.backend.admin

import java.net.InetAddress

/**
 * Snapshot stored on `admin_task_runs.executor` so Admin → Task runs shows which node/runtime ran the job.
 */
data class TaskRunExecutorSnapshot(
    val runtime: String,
    val environment: String,
    val label: String,
    val service: String? = null,
    val revision: String? = null,
    val host: String? = null,
)

object TaskRunExecutorIdentity {
    fun build(runtime: String): TaskRunExecutorSnapshot {
        val environment = resolveEnvironment()
        val service = System.getenv("K_SERVICE")?.trim()?.takeIf { it.isNotEmpty() }
            ?: if (runtime == "spring") "atxfinance-backend" else "atxfinance-core-app"
        val revision = System.getenv("K_REVISION")?.trim()?.takeIf { it.isNotEmpty() }
        val host = readHost()

        val runtimeTitle = if (runtime == "spring") "Spring" else "Next"
        val labelParts = mutableListOf(runtimeTitle, environmentLabel(environment))
        if (revision != null) {
            labelParts.add(if (revision.length > 36) revision.take(36) + "…" else revision)
        } else if (host != null && environment == "local") {
            labelParts.add(host)
        }

        return TaskRunExecutorSnapshot(
            runtime = runtime,
            environment = environment,
            label = labelParts.joinToString(" · "),
            service = service,
            revision = revision,
            host = host,
        )
    }

    fun toDocument(snapshot: TaskRunExecutorSnapshot): org.bson.Document =
        org.bson.Document(
            mapOf(
                "runtime" to snapshot.runtime,
                "environment" to snapshot.environment,
                "label" to snapshot.label,
                "service" to snapshot.service,
                "revision" to snapshot.revision,
                "host" to snapshot.host,
            ).filterValues { it != null },
        )

    private fun resolveEnvironment(): String {
        val deployTarget =
            (System.getenv("ATX_DEPLOY_TARGET") ?: System.getenv("DEPLOY_TARGET") ?: "")
                .trim()
                .lowercase()
        if (deployTarget in setOf("deploy", "production", "prod")) {
            return "production"
        }
        if (deployTarget in setOf("stage", "staging")) {
            return "staging"
        }
        val nodeEnv = (System.getenv("NODE_ENV") ?: System.getenv("SPRING_PROFILES_ACTIVE") ?: "development")
            .trim()
            .lowercase()
        if (nodeEnv.contains("test")) {
            return "test"
        }
        if (nodeEnv.contains("dev")) {
            return "local"
        }
        if (nodeEnv.contains("prod")) {
            return if (!System.getenv("K_SERVICE").isNullOrBlank()) "production" else "unknown"
        }
        return "unknown"
    }

    private fun environmentLabel(environment: String): String =
        when (environment) {
            "local" -> "local"
            "staging" -> "staging"
            "production" -> "production"
            "test" -> "test"
            else -> "unknown"
        }

    private fun readHost(): String? {
        System.getenv("K_SERVICE")?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
        System.getenv("POD_NAME")?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
        val hostname = System.getenv("HOSTNAME")?.trim()?.takeIf { it.isNotEmpty() && it != "0.0.0.0" }
        if (hostname != null) {
            return hostname
        }
        return try {
            InetAddress.getLocalHost().hostName
        } catch (_: Exception) {
            null
        }
    }
}
