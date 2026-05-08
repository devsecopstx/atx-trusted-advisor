package com.atxfinance.backend.strategy

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.core.env.Environment
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestTemplate

data class XaiChatCompletionResult(val model: String, val outputText: String)

@Component
class XaiChatCompletionsClient(
    private val env: Environment,
    private val restTemplate: RestTemplate,
    private val objectMapper: ObjectMapper,
) {
    fun complete(
        model: String,
        system: String,
        user: String,
        temperature: Double = 0.2,
        agentCount: Int? = null,
        reasoningEffort: String? = null,
        /** xAI prompt caching — stable key for identical system-prefix affinity across jobs. */
        promptCacheKey: String? = null,
    ): XaiChatCompletionResult {
        val apiKey = env.getProperty("XAI_API_KEY")?.trim()
            ?: throw IllegalStateException("XAI_API_KEY is required for chat completions")
        val baseUrl = env.getProperty("XAI_BASE_URL")?.trim()?.takeIf { it.isNotEmpty() } ?: "https://api.x.ai/v1"
        val url = "${baseUrl.trimEnd('/')}/chat/completions"
        val body = mutableMapOf<String, Any>(
            "model" to model,
            "temperature" to temperature,
            "messages" to listOf(
                mapOf("role" to "system", "content" to system),
                mapOf("role" to "user", "content" to user),
            ),
        )
        if (agentCount != null && agentCount > 0 && reasoningEffort != null) {
            body["agent_count"] = agentCount
            body["reasoning"] = mapOf("effort" to reasoningEffort)
        } else if (reasoningEffort != null) {
            body["reasoning"] = mapOf("effort" to reasoningEffort)
        }
        val cacheKey = promptCacheKey?.trim()?.takeIf { it.isNotEmpty() }
        if (cacheKey != null) {
            body["prompt_cache_key"] = cacheKey.take(256)
        }
        val headers = HttpHeaders()
        headers.setBearerAuth(apiKey)
        headers.contentType = MediaType.APPLICATION_JSON
        val entity = HttpEntity(objectMapper.writeValueAsString(body), headers)
        val response = restTemplate.postForEntity(url, entity, String::class.java)
        val payload = objectMapper.readTree(response.body ?: "{}")
        if (!response.statusCode.is2xxSuccessful) {
            val err = payload.path("error").toString()
            throw IllegalStateException("xAI chat failed (${response.statusCode}): $err")
        }
        val text = payload.path("choices").get(0)?.path("message")?.path("content")?.asText()?.trim().orEmpty()
        if (text.isEmpty()) {
            throw IllegalStateException("xAI chat returned empty content")
        }
        val outModel = payload.path("model").asText(model)
        return XaiChatCompletionResult(model = outModel, outputText = text)
    }
}
