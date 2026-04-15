package com.atxfinance.backend.admin

import com.atxfinance.backend.config.AtxfinanceProperties
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClientException
import org.springframework.web.client.RestTemplate

/**
 * Invokes Next.js [executeScheduledTask] via [POST /api/internal/scheduler/execute-task] so JVM-scheduled
 * system jobs run the real Yahoo/Mongo task-runner (watchlist, price scanner, …) instead of Kotlin stubs.
 */
@Component
class NextSchedulerExecuteClient(
    private val props: AtxfinanceProperties,
    @Qualifier("schedulerDelegateRestTemplate")
    private val restTemplate: RestTemplate,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun isConfigured(): Boolean {
        val base = props.schedulerDelegate.nextBaseUrl.trim()
        val sec = props.schedulerDelegate.internalSecret.trim()
        return base.isNotEmpty() && sec.length >= 24
    }

    /** @return Triple(runIdHex, status, output) */
    fun executeTask(taskIdHex: String, triggeredBy: String): Triple<String, String, String> {
        val base = props.schedulerDelegate.nextBaseUrl.trim().trimEnd('/')
        val secret = props.schedulerDelegate.internalSecret.trim()
        val url = "$base/api/internal/scheduler/execute-task"
        val headers = HttpHeaders()
        headers.contentType = MediaType.APPLICATION_JSON
        headers.set("X-Atx-Scheduler-Secret", secret)
        val body = mapOf("taskId" to taskIdHex, "triggeredBy" to triggeredBy)
        val entity = HttpEntity<Map<String, Any>>(body, headers)
        return try {
            val response = restTemplate.exchange(url, HttpMethod.POST, entity, Map::class.java)
            val root = response.body as? Map<*, *> ?: throw IllegalStateException("empty response body")
            @Suppress("UNCHECKED_CAST")
            val data = root["data"] as? Map<String, Any?> ?: throw IllegalStateException("missing data")
            val runId = (data["runId"] as? String)?.trim().orEmpty().ifEmpty { "unknown" }
            val status = (data["status"] as? String)?.trim().orEmpty().ifEmpty { "failed" }
            val output = (data["output"] as? String) ?: ""
            Triple(runId, status, output)
        } catch (e: RestClientException) {
            log.warn("[scheduler-delegate] Next execute failed for taskId={}: {}", taskIdHex, e.message)
            Triple("delegate-error", "failed", "scheduler_delegate: ${e.message ?: e.javaClass.simpleName}")
        } catch (e: Exception) {
            log.warn("[scheduler-delegate] Next execute error for taskId={}", taskIdHex, e)
            Triple("delegate-error", "failed", "scheduler_delegate: ${e.message ?: e.javaClass.simpleName}")
        }
    }
}
