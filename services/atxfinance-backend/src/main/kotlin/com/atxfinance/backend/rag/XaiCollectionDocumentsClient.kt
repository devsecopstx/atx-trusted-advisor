package com.atxfinance.backend.rag

import org.springframework.core.env.Environment
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.stereotype.Component
import org.springframework.web.client.RestTemplate

@Component
class XaiCollectionDocumentsClient(
    private val env: Environment,
    private val restTemplate: RestTemplate,
) {
    fun linkFileToCollection(collectionId: String, fileId: String) {
        val key = env.getProperty("XAI_MANAGEMENT_API_KEY")?.trim()
            ?: error("XAI_MANAGEMENT_API_KEY is required to link files to collections")
        val base =
            env.getProperty("XAI_MANAGEMENT_BASE_URL")?.trim()?.takeIf { it.isNotEmpty() }
                ?: "https://management-api.x.ai/v1"
        val cid = collectionId.trim()
        val fid = fileId.trim()
        val url = "${base.trimEnd('/')}/collections/$cid/documents/$fid"
        val headers = HttpHeaders()
        headers.setBearerAuth(key)
        val entity = HttpEntity<Void>(headers)
        val response = restTemplate.exchange(url, HttpMethod.POST, entity, String::class.java)
        if (!response.statusCode.is2xxSuccessful && response.statusCode.value() != 409) {
            throw IllegalStateException("xAI link file to collection failed: ${response.statusCode} ${response.body}")
        }
    }
}
