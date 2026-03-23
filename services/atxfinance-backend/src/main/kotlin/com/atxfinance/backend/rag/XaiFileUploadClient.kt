package com.atxfinance.backend.rag

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.core.env.Environment
import org.springframework.core.io.ByteArrayResource
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestTemplate

data class XaiUploadResult(
    val fileId: String,
    val processingStatus: String,
)

data class XaiFileMetadata(
    val fileId: String,
    val processingStatus: String,
    val uploadErrorMessage: String?,
)

@Component
class XaiFileUploadClient(
    private val env: Environment,
    private val restTemplate: RestTemplate,
    private val objectMapper: ObjectMapper,
) {
    fun upload(filename: String, bytes: ByteArray, @Suppress("UNUSED_PARAMETER") contentType: String): XaiUploadResult {
        val apiKey = env.getProperty("XAI_API_KEY")?.trim() ?: error("XAI_API_KEY is required for RAG upload")
        val baseUrl = env.getProperty("XAI_BASE_URL")?.trim()?.takeIf { it.isNotEmpty() } ?: "https://api.x.ai/v1"
        val url = "${baseUrl.trimEnd('/')}/files"

        val body = LinkedMultiValueMap<String, Any>()
        body.add(
            "file",
            object : ByteArrayResource(bytes) {
                override fun getFilename(): String = filename
            },
        )

        val headers = HttpHeaders()
        headers.setBearerAuth(apiKey)
        headers.contentType = MediaType.MULTIPART_FORM_DATA

        val entity = HttpEntity(body, headers)
        val response = restTemplate.postForEntity(url, entity, String::class.java)
        val payload = objectMapper.readTree(response.body ?: "{}")
        if (!response.statusCode.is2xxSuccessful) {
            throw IllegalStateException("xAI file upload failed: $payload")
        }
        val idNode = payload.get("id")
        val fileIdNode = payload.get("file_id")
        val fileId =
            idNode?.takeIf { !it.isNull }?.asText()?.takeIf { it.isNotBlank() }
                ?: fileIdNode?.takeIf { !it.isNull }?.asText()?.takeIf { it.isNotBlank() }
                ?: error("xAI file upload missing file id: $payload")
        val processing =
            payload.get("processing_status")?.takeIf { !it.isNull }?.asText()?.takeIf { it.isNotBlank() }
                ?: "unknown"
        return XaiUploadResult(fileId = fileId, processingStatus = processing)
    }

    fun getFileMetadata(xaiFileId: String): XaiFileMetadata {
        val apiKey = env.getProperty("XAI_API_KEY")?.trim() ?: error("XAI_API_KEY is required")
        val baseUrl = env.getProperty("XAI_BASE_URL")?.trim()?.takeIf { it.isNotEmpty() } ?: "https://api.x.ai/v1"
        val url = "${baseUrl.trimEnd('/')}/files/${xaiFileId.trim()}"

        val headers = HttpHeaders()
        headers.setBearerAuth(apiKey)

        val entity = HttpEntity<Void>(headers)
        val response = restTemplate.exchange(url, org.springframework.http.HttpMethod.GET, entity, String::class.java)
        val payload = objectMapper.readTree(response.body ?: "{}")
        if (!response.statusCode.is2xxSuccessful) {
            throw IllegalStateException("xAI file metadata failed: $payload")
        }
        val id = payload.get("id")?.takeIf { !it.isNull }?.asText()
            ?: payload.get("file_id")?.takeIf { !it.isNull }?.asText()
            ?: xaiFileId
        val processing = payload.get("processing_status")?.takeIf { !it.isNull }?.asText()?.takeIf { it.isNotBlank() }
            ?: "unknown"
        val uploadError = payload.get("upload_error_message")?.takeIf { !it.isNull }?.asText()?.trim()?.takeIf { it.isNotEmpty() }
        return XaiFileMetadata(fileId = id, processingStatus = processing, uploadErrorMessage = uploadError)
    }
}
