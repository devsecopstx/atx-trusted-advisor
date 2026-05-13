package com.atxfinance.backend.xchat

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class XchatWireToolsForResponsesTest {
    @Test
    fun `yahoo_finance marker becomes flat function tool`() {
        val out =
            XchatWireToolsForResponses.normalize(
                listOf(
                    mapOf("type" to "atx_function"),
                    mapOf("type" to "yahoo_finance"),
                ),
            )
        assertTrue(out.any { it["name"] == "atx_function" && it["type"] == "function" })
        val yf = out.first { it["name"] == "yahoo_finance" }
        assertEquals("function", yf["type"])
    }

    @Test
    fun `nested OpenAI function yahoo_finance flattens to canonical`() {
        val out =
            XchatWireToolsForResponses.normalize(
                listOf(
                    mapOf(
                        "type" to "function",
                        "function" to
                            mapOf(
                                "name" to "yahoo_finance",
                                "parameters" to mapOf("type" to "object", "properties" to emptyMap<String, Any?>()),
                            ),
                    ),
                ),
            )
        val yf = out.first { it["name"] == "yahoo_finance" }
        assertEquals("function", yf["type"])
        assertTrue(yf.containsKey("parameters"))
    }

    @Test
    fun `yahoo_finance type with surrounding whitespace normalizes`() {
        val out =
            XchatWireToolsForResponses.normalize(
                listOf(mapOf("type" to "  Yahoo_Finance  ")),
            )
        assertEquals("function", out.first { it["name"] == "yahoo_finance" }["type"])
    }

    @Test
    fun `file_search uses vector_store_ids for xAI responses`() {
        val out =
            XchatWireToolsForResponses.normalize(
                listOf(
                    mapOf(
                        "type" to "file_search",
                        "name" to "file_search",
                        "source" to mapOf("collection_ids" to listOf("col_abc123")),
                    ),
                ),
            )
        val fs = out.first { it["name"] == "file_search" }
        assertEquals("file_search", fs["type"])
        @Suppress("UNCHECKED_CAST")
        val vs = fs["vector_store_ids"] as? List<*>
        assertTrue(vs != null && vs.contains("col_abc123"))
        assertTrue(!fs.containsKey("source"))
    }

    @Test
    fun `collections_search maps to file_search with vector_store_ids`() {
        val out =
            XchatWireToolsForResponses.normalize(
                listOf(
                    mapOf("type" to "collections_search", "collection_ids" to listOf("c1", "c2")),
                ),
            )
        val fs = out.first { it["name"] == "file_search" }
        @Suppress("UNCHECKED_CAST")
        val vs = fs["vector_store_ids"] as? List<*>
        assertEquals(listOf("c1", "c2"), vs)
    }
}
