package com.atxfinance.backend.rag

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.core.env.Environment
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestTemplate

@Component
class XaiDocumentsSearchClient(
    private val env: Environment,
    private val restTemplate: RestTemplate,
    private val objectMapper: ObjectMapper,
) {
    data class Snippet(val text: String, val documentName: String?, val documentId: String?)

    fun search(query: String, collectionIds: List<String>, topK: Int): List<Snippet> {
        val ids = collectionIds.map { it.trim() }.filter { it.isNotEmpty() }
        if (ids.isEmpty()) {
            return emptyList()
        }
        val apiKey = env.getProperty("XAI_API_KEY")?.trim()
            ?: throw IllegalStateException("XAI_API_KEY is required for documents search")
        val baseUrl = env.getProperty("XAI_BASE_URL")?.trim()?.takeIf { it.isNotEmpty() } ?: "https://api.x.ai/v1"
        val url = "${baseUrl.trimEnd('/')}/documents/search"
        val body = mapOf(
            "query" to query,
            "source" to mapOf("collection_ids" to ids),
            "retrieval_mode" to mapOf("type" to "hybrid"),
            "top_k" to topK,
        )
        val headers = HttpHeaders()
        headers.setBearerAuth(apiKey)
        headers.contentType = MediaType.APPLICATION_JSON
        val entity = HttpEntity(objectMapper.writeValueAsString(body), headers)
        val response = restTemplate.postForEntity(url, entity, String::class.java)
        if (!response.statusCode.is2xxSuccessful) {
            throw IllegalStateException("xAI documents search failed: ${response.statusCode} ${response.body}")
        }
        val root = objectMapper.readTree(response.body ?: "{}")
        return extractSnippets(root, topK)
    }

    private fun extractSnippets(payload: JsonNode, max: Int): List<Snippet> {
        val candidates = sequenceOf(payload.get("data"), payload.get("results"), payload.get("documents"), payload.get("matches"))
            .firstOrNull { it != null && it.isArray }
            ?: return emptyList()
        val out = ArrayList<Snippet>()
        for (i in 0 until candidates.size()) {
            if (out.size >= max) break
            val el = candidates.get(i) ?: continue
            if (!el.isObject) continue
            val docId = el.path("id").asText(null) ?: el.path("document_id").asText(null)
            val name = el.path("name").asText(null) ?: el.path("title").asText(null)
            val texts = mutableListOf<String>()
            textOrNull(el.get("text"))?.let(texts::add)
            textOrNull(el.get("content"))?.let(texts::add)
            textOrNull(el.get("snippet"))?.let(texts::add)
            textOrNull(el.get("excerpt"))?.let(texts::add)
            for (sn in el.path("snippets")) {
                if (sn.isObject) {
                    textOrNull(sn.get("text"))?.let(texts::add)
                    textOrNull(sn.get("content"))?.let(texts::add)
                }
            }
            for (ch in el.path("chunks")) {
                if (ch.isObject) {
                    textOrNull(ch.get("text"))?.let(texts::add)
                    textOrNull(ch.get("content"))?.let(texts::add)
                }
            }
            val merged = texts.firstOrNull { it.isNotBlank() }?.trim() ?: continue
            out.add(Snippet(text = merged.take(4000), documentName = name, documentId = docId))
        }
        return out
    }

    private fun textOrNull(n: JsonNode?): String? {
        if (n == null || n.isNull || !n.isTextual) return null
        return n.asText()
    }
}
