package com.atxfinance.backend.xchat

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper

data class XaiParsedToolCall(
    val callId: String,
    val name: String,
    val args: Map<String, Any?>,
)

object XaiResponsesJson {
    fun extractOutputText(payload: JsonNode): String {
        val direct = payload.path("output_text").asText("").trim()
        if (direct.isNotEmpty()) {
            return direct
        }
        val fragments = mutableListOf<String>()
        val output = payload.path("output")
        if (output.isArray) {
            for (entry in output) {
                val content = entry.path("content")
                if (!content.isArray) {
                    continue
                }
                for (piece in content) {
                    val text = piece.path("text").asText("").trim()
                    if (text.isNotEmpty()) {
                        fragments.add(text)
                    }
                }
            }
        }
        return fragments.joinToString("\n").trim()
    }

    fun extractToolCalls(payload: JsonNode, objectMapper: ObjectMapper): List<XaiParsedToolCall> {
        val output = payload.path("output")
        if (!output.isArray) {
            return emptyList()
        }
        val calls = mutableListOf<XaiParsedToolCall>()
        for (entry in output) {
            if (entry.path("type").asText("") != "function_call") {
                continue
            }
            val callId = entry.path("call_id").asText("").ifBlank { entry.path("id").asText("") }
            val name = entry.path("name").asText("").trim()
            if (name.isEmpty()) {
                continue
            }
            val argsNode = entry.get("arguments")
            val args =
                when {
                    argsNode == null || argsNode.isNull -> emptyMap()
                    argsNode.isTextual -> parseArgsObject(argsNode.asText(), objectMapper)
                    argsNode.isObject -> objectMapper.convertValue(argsNode, Map::class.java) as Map<String, Any?>
                    else -> emptyMap()
                }
            calls.add(XaiParsedToolCall(callId = callId, name = name, args = args))
        }
        return calls
    }

    private fun parseArgsObject(raw: String, objectMapper: ObjectMapper): Map<String, Any?> {
        if (raw.isBlank()) {
            return emptyMap()
        }
        return runCatching {
            objectMapper.readValue(raw, Map::class.java) as Map<String, Any?>
        }.getOrDefault(emptyMap())
    }
}
