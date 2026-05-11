package com.atxfinance.backend.xchat

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class XaiResponsesJsonTest {
    private val objectMapper = ObjectMapper()

    @Test
    fun `extractOutputText prefers output_text`() {
        val payload = objectMapper.readTree("""{"output_text":"hello"}""")
        assertEquals("hello", XaiResponsesJson.extractOutputText(payload))
    }

    @Test
    fun `extractToolCalls reads function_call rows`() {
        val payload =
            objectMapper.readTree(
                """
                {
                  "output": [
                    {
                      "type": "function_call",
                      "call_id": "call_1",
                      "name": "atx_function",
                      "arguments": "{\"operation\":\"watchlist_snapshot\"}"
                    }
                  ]
                }
                """.trimIndent(),
            )
        val calls = XaiResponsesJson.extractToolCalls(payload, objectMapper)
        assertEquals(1, calls.size)
        assertEquals("atx_function", calls[0].name)
        assertEquals("watchlist_snapshot", calls[0].args["operation"])
        assertTrue(calls[0].callId.isNotEmpty())
    }
}
