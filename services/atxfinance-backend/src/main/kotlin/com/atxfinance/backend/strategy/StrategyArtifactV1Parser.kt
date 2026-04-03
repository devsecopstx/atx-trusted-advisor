package com.atxfinance.backend.strategy

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper

sealed class StrategyArtifactParseResult {
    data class Ok(val markdown: String, val json: JsonNode) : StrategyArtifactParseResult()
    data class Failure(val code: String, val message: String) : StrategyArtifactParseResult()
}

/**
 * Phase 1 artifact: model output is Markdown with exactly one fenced ```json … ``` block (v1).
 * v2 JSON Schema validation is deferred — [StrategyArtifactV1Parser] only checks required keys and types loosely.
 */
object StrategyArtifactV1Parser {
    private val fenceRegex = Regex("```json\\s*([\\s\\S]*?)```", RegexOption.IGNORE_CASE)

    fun parseFullOutput(outputText: String, objectMapper: ObjectMapper): StrategyArtifactParseResult {
        val trimmed = outputText.trim()
        if (trimmed.isEmpty()) {
            return StrategyArtifactParseResult.Failure("artifact_empty_output", "Model returned empty text")
        }
        val match = fenceRegex.find(trimmed)
            ?: return StrategyArtifactParseResult.Failure(
                "artifact_missing_json_fence",
                "Response must include a ```json ... ``` fenced block with strategy artifact v1",
            )
        val jsonRaw = match.groupValues[1].trim()
        if (jsonRaw.isEmpty()) {
            return StrategyArtifactParseResult.Failure("artifact_empty_json_fence", "Fenced json block is empty")
        }
        val node = try {
            objectMapper.readTree(jsonRaw)
        } catch (e: Exception) {
            return StrategyArtifactParseResult.Failure(
                "artifact_json_parse_error",
                e.message ?: "Invalid JSON in fence",
            )
        }
        if (!node.isObject) {
            return StrategyArtifactParseResult.Failure("artifact_json_not_object", "Fenced JSON must be an object")
        }
        val version = node.get("version")?.asText()?.trim()
        if (version != "1") {
            return StrategyArtifactParseResult.Failure(
                "artifact_version_mismatch",
                "artifact.version must be \"1\" for v1 contract",
            )
        }
        val rational = node.get("rational_recommendation")?.asText()?.trim()
        if (rational.isNullOrEmpty()) {
            return StrategyArtifactParseResult.Failure(
                "artifact_missing_rational",
                "artifact.rational_recommendation is required",
            )
        }
        val legs = node.get("legs")
        if (legs == null || !legs.isArray) {
            return StrategyArtifactParseResult.Failure("artifact_missing_legs", "artifact.legs must be a JSON array")
        }
        return StrategyArtifactParseResult.Ok(markdown = trimmed, json = node)
    }
}
