package com.atxfinance.backend.notify

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration

@Service
class SlackWebhookService(
    @Value("\${SLACK_WEBHOOK_URL:}") private val webhookUrl: String,
) {
    private val client: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build()

    fun postJson(jsonBody: String) {
        val url = webhookUrl.trim()
        if (url.isEmpty()) {
            return
        }
        val req = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofSeconds(10))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
            .build()
        try {
            client.send(req, HttpResponse.BodyHandlers.discarding())
        } catch (_: Exception) {
            // best-effort; mirrors Next fire-and-forget slack
        }
    }
}
