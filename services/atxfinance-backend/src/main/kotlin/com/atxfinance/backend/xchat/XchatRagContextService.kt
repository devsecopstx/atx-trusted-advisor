package com.atxfinance.backend.xchat

import com.atxfinance.backend.rag.XaiDocumentsSearchClient
import org.bson.Document
import org.springframework.stereotype.Service

@Service
class XchatRagContextService(
    private val documentsSearchClient: XaiDocumentsSearchClient,
) {
    fun buildRagContext(
        message: String,
        persona: Document?,
        topK: Int = 4,
    ): Pair<String, Int> {
        val collectionIds = XchatPersonaSupport.linkedCollectionIds(persona)
        if (collectionIds.isEmpty() || message.isBlank()) {
            return "" to 0
        }
        val snippets =
            runCatching {
                documentsSearchClient.search(message, collectionIds, topK.coerceIn(1, 10))
            }.getOrDefault(emptyList())
        if (snippets.isEmpty()) {
            return "" to 0
        }
        val body =
            buildString {
                appendLine("RAG context (persona collections):")
                for (snippet in snippets) {
                    appendLine("- ${snippet.text}")
                }
            }.trimEnd()
        return body to snippets.size
    }
}
