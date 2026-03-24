package com.atxfinance.backend.rag

object RagMime {
    fun isTextLike(mimeType: String): Boolean {
        val m = mimeType.lowercase()
        if (m.startsWith("text/")) {
            return true
        }
        return m == "application/json" ||
            m == "application/xml" ||
            m == "application/javascript"
    }
}
