package com.atxfinance.backend.strategy

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class StrategyArtifactV1ParserTest {
    private val mapper = ObjectMapper()

    @Test
    fun `parses markdown with json fence`() {
        val raw = """
            ## Brief
            Do the trade carefully.

            ```json
            {
              "version": "1",
              "underlying": "TSLA",
              "structure": "covered_call",
              "rational_recommendation": "Income with stock risk.",
              "legs": [{"side": "sell", "type": "call", "strike": 300, "expiry": "2026-06-20", "quantity": 1}]
            }
            ```
        """.trimIndent()
        val r = StrategyArtifactV1Parser.parseFullOutput(raw, mapper)
        assertTrue(r is StrategyArtifactParseResult.Ok)
        val ok = r as StrategyArtifactParseResult.Ok
        assertEquals("TSLA", ok.json.path("underlying").asText())
        assertTrue(ok.markdown.contains("## Brief"))
    }

    @Test
    fun `fails without json fence`() {
        val r = StrategyArtifactV1Parser.parseFullOutput("just prose", mapper)
        assertTrue(r is StrategyArtifactParseResult.Failure)
        assertEquals("artifact_missing_json_fence", (r as StrategyArtifactParseResult.Failure).code)
    }

    @Test
    fun `fails wrong version`() {
        val raw = """```json
        {"version":"2","rational_recommendation":"x","legs":[]}
        ```"""
        val r = StrategyArtifactV1Parser.parseFullOutput(raw, mapper)
        assertTrue(r is StrategyArtifactParseResult.Failure)
        assertEquals("artifact_version_mismatch", (r as StrategyArtifactParseResult.Failure).code)
    }
}
