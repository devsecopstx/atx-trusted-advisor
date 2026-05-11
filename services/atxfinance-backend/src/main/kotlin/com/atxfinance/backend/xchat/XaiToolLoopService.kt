package com.atxfinance.backend.xchat

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.stereotype.Service

@Service
class XaiToolLoopService(
    private val xaiResponsesClient: XaiResponsesClient,
    private val atxFunctionExecutor: AtxFunctionExecutor,
    private val objectMapper: ObjectMapper,
) {
    data class StreamHooks(
        val onTurnStart: (Int) -> Unit = {},
        val onToolStatus: (tool: String, operation: String?, status: String) -> Unit = { _, _, _ -> },
    )

    data class Result(
        val outputText: String,
        val model: String,
        val responseId: String?,
        val turnsUsed: Int,
        val toolCalls: List<Map<String, Any?>>,
        val rawPayload: JsonNode,
    )

    fun runLoop(
        model: String,
        systemPrompt: String,
        userPrompt: String,
        tools: List<Map<String, Any?>>,
        toolChoice: String,
        maxTurns: Int,
        executionContext: AtxFunctionExecutionContext,
        streamHooks: StreamHooks = StreamHooks(),
    ): Result {
        val apiKey =
            xaiResponsesClient.apiKeyOrNull()
                ?: throw IllegalStateException("XAI_API_KEY is required for xChat tool loop")
        val wireTools = normalizeWireTools(tools)
        val cappedTurns = maxTurns.coerceIn(1, 10)
        val perRequestMaxTurns = cappedTurns.coerceAtMost(16)
        var conversationInput: Any = userPrompt
        var previousResponseId: String? = null
        var turnsUsed = 0
        var lastModel = model
        val toolCalls = mutableListOf<Map<String, Any?>>()

        for (turn in 0 until cappedTurns) {
            turnsUsed = turn + 1
            streamHooks.onTurnStart(turn)

            val requestBody = linkedMapOf<String, Any?>(
                "model" to model,
                "input" to conversationInput,
                "tools" to wireTools,
                "tool_choice" to toolChoice,
                "max_turns" to perRequestMaxTurns,
            )
            if (previousResponseId != null) {
                requestBody["previous_response_id"] = previousResponseId
            } else {
                requestBody["instructions"] = systemPrompt
            }

            val payload = postResponses(apiKey, requestBody)
            lastModel = payload.path("model").asText(model)
            payload.path("id").asText("").trim().takeIf { it.isNotEmpty() }?.let { previousResponseId = it }

            val pending = XaiResponsesJson.extractToolCalls(payload, objectMapper)
            if (pending.isEmpty()) {
                val outputText = XaiResponsesJson.extractOutputText(payload)
                return Result(
                    outputText = outputText,
                    model = lastModel,
                    responseId = previousResponseId,
                    turnsUsed = turnsUsed,
                    toolCalls = toolCalls,
                    rawPayload = payload,
                )
            }

            val toolResults = mutableListOf<Map<String, Any?>>()
            for (call in pending) {
                if (HOSTED_TOOL_NAMES.contains(call.name)) {
                    toolCalls.add(
                        mapOf(
                            "name" to call.name,
                            "args" to call.args,
                            "result" to "{}",
                            "durationMs" to 0,
                        ),
                    )
                    toolResults.add(
                        mapOf(
                            "type" to "function_call_output",
                            "call_id" to call.callId,
                            "output" to "{}",
                        ),
                    )
                    continue
                }
                if (!LOCAL_TOOL_NAMES.contains(call.name)) {
                    toolCalls.add(
                        mapOf(
                            "name" to call.name,
                            "args" to call.args,
                            "error" to "unsupported_tool",
                            "durationMs" to 0,
                        ),
                    )
                    toolResults.add(
                        mapOf(
                            "type" to "function_call_output",
                            "call_id" to call.callId,
                            "output" to objectMapper.writeValueAsString(mapOf("error" to "unsupported_tool")),
                        ),
                    )
                    continue
                }

                val operation = (call.args["operation"] as? String)?.trim()
                streamHooks.onToolStatus("atx_function", operation, "running")
                val started = System.currentTimeMillis()
                val executorResult = atxFunctionExecutor.executeToolCall(call.name, call.args, executionContext)
                val durationMs = (System.currentTimeMillis() - started).coerceAtLeast(0)
                streamHooks.onToolStatus("atx_function", operation, "done")
                toolCalls.add(
                    mapOf(
                        "name" to call.name,
                        "args" to call.args,
                        "result" to executorResult.result,
                        "error" to executorResult.error,
                        "durationMs" to durationMs,
                    ),
                )
                val output =
                    if (executorResult.error != null) {
                        objectMapper.writeValueAsString(mapOf("error" to executorResult.error))
                    } else {
                        executorResult.result
                    }
                toolResults.add(
                    mapOf(
                        "type" to "function_call_output",
                        "call_id" to call.callId,
                        "output" to output,
                    ),
                )
            }
            conversationInput = toolResults
        }

        return Result(
            outputText = "",
            model = lastModel,
            responseId = previousResponseId,
            turnsUsed = turnsUsed,
            toolCalls = toolCalls,
            rawPayload = objectMapper.createObjectNode(),
        )
    }

    private fun postResponses(apiKey: String, requestBody: Map<String, Any?>): JsonNode {
        val url = "${xaiResponsesClient.baseUrl().trimEnd('/')}/responses"
        val headers = HttpHeaders()
        headers.setBearerAuth(apiKey)
        headers.contentType = MediaType.APPLICATION_JSON
        val entity = HttpEntity(objectMapper.writeValueAsString(requestBody), headers)
        val response = xaiResponsesClient.restTemplate().postForEntity(url, entity, String::class.java)
        if (!response.statusCode.is2xxSuccessful) {
            throw IllegalStateException("xAI responses failed: ${response.statusCode} ${response.body}")
        }
        return objectMapper.readTree(response.body ?: "{}")
    }

    private fun normalizeWireTools(tools: List<Map<String, Any?>>): List<Map<String, Any?>> {
        val out = mutableListOf<Map<String, Any?>>()
        for (tool in tools) {
            val type = tool["type"]?.toString()
            when (type) {
                "collections_search" -> {
                    val ids = (tool["collection_ids"] as? List<*>)?.mapNotNull { it?.toString()?.trim() }?.filter { it.isNotEmpty() }.orEmpty()
                    if (ids.isNotEmpty()) {
                        out.add(
                            mapOf(
                                "type" to "file_search",
                                "name" to "file_search",
                                "source" to mapOf("collection_ids" to ids),
                            ),
                        )
                    }
                }
                "file_search" -> {
                    val source = tool["source"] as? Map<*, *>
                    val ids =
                        (source?.get("collection_ids") as? List<*>)?.mapNotNull { it?.toString()?.trim() }?.filter { it.isNotEmpty() }
                            ?: (tool["collection_ids"] as? List<*>)?.mapNotNull { it?.toString()?.trim() }?.filter { it.isNotEmpty() }
                            ?: emptyList()
                    if (ids.isNotEmpty()) {
                        out.add(
                            mapOf(
                                "type" to "file_search",
                                "name" to "file_search",
                                "source" to mapOf("collection_ids" to ids),
                            ),
                        )
                    }
                }
                "function" -> out.add(tool)
                else -> {
                    val function = tool["function"] as? Map<*, *>
                    if (function != null) {
                        val flattened = LinkedHashMap<String, Any?>()
                        flattened["type"] = "function"
                        flattened["name"] = function["name"] ?: tool["name"]
                        flattened["description"] = function["description"] ?: tool["description"]
                        flattened["parameters"] = function["parameters"] ?: tool["parameters"]
                        out.add(flattened)
                    } else {
                        out.add(tool)
                    }
                }
            }
        }
        if (out.none { it["name"] == "atx_function" }) {
            out.add(XchatPersonaSupport.wireTools(null).first { it["name"] == "atx_function" })
        }
        return out.take(32)
    }

    companion object {
        private val LOCAL_TOOL_NAMES = setOf("atx_function", "atxfinance")
        private val HOSTED_TOOL_NAMES =
            setOf(
                "web_search",
                "x_search",
                "file_search",
                "collections_search",
                "code_interpreter",
            )
    }
}
