package com.atxfinance.backend.rag

data class RagChunkDraft(
    val text: String,
    val tokenEstimate: Int,
)

object RagTextChunker {
    fun chunkText(
        text: String,
        chunkSize: Int = 900,
        overlap: Int = 120,
    ): List<RagChunkDraft> {
        val cleaned = text.replace("\r\n", "\n").trim()
        if (cleaned.isEmpty()) {
            return emptyList()
        }
        val chunks = mutableListOf<RagChunkDraft>()
        var cursor = 0
        while (cursor < cleaned.length) {
            val end = minOf(cleaned.length, cursor + chunkSize)
            val chunk = cleaned.substring(cursor, end).trim()
            if (chunk.isNotEmpty()) {
                chunks.add(
                    RagChunkDraft(
                        text = chunk,
                        tokenEstimate = kotlin.math.ceil(chunk.length / 4.0).toInt(),
                    ),
                )
            }
            if (end >= cleaned.length) {
                break
            }
            cursor = maxOf(0, end - overlap)
        }
        return chunks
    }
}
