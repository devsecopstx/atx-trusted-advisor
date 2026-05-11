package com.atxfinance.backend.xchat

import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.env.Environment
import org.springframework.stereotype.Component
import org.springframework.web.client.RestTemplate

/**
 * Phase 2: non-streaming xAI `/v1/responses` tool loop. Phase 1 keeps this as a configured client shell.
 */
@Component
class XaiResponsesClient(
    private val env: Environment,
    @Qualifier("xaiResponsesRestTemplate") private val restTemplate: RestTemplate,
) {
    fun baseUrl(): String =
        env.getProperty("XAI_BASE_URL")?.trim()?.takeIf { it.isNotEmpty() } ?: "https://api.x.ai/v1"

    fun apiKeyOrNull(): String? = env.getProperty("XAI_API_KEY")?.trim()?.takeIf { it.isNotEmpty() }

    fun restTemplate(): RestTemplate = restTemplate
}
