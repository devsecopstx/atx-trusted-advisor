package com.atxfinance.backend.xchat

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test

class XaiResponsesUsageTest {
    private val objectMapper = ObjectMapper()

    @Test
    fun `extract maps usage fields`() {
        val payload =
            objectMapper.readTree(
                """
                {
                  "usage": {
                    "prompt_tokens": 12,
                    "completion_tokens": 8,
                    "total_tokens": 20,
                    "cost_in_usd_ticks": 3
                  }
                }
                """.trimIndent(),
            )
        val usage = XaiResponsesUsage.extract(payload)
        assertNotNull(usage)
        assertEquals(12, usage?.inputTokens)
        assertEquals(8, usage?.outputTokens)
        assertEquals(20, usage?.totalTokens)
        assertEquals(3, usage?.costUsdTicks)
    }
}
