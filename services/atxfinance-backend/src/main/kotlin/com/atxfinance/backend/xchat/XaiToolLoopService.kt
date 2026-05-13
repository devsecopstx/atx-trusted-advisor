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
        val wireTools = XchatWireToolsForResponses.normalize(tools)
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
                val toolLabel = call.name.trim().lowercase()
                streamHooks.onToolStatus(toolLabel, operation, "running")
                val started = System.currentTimeMillis()
                val executorResult = atxFunctionExecutor.executeToolCall(call.name, call.args, executionContext)
                val durationMs = (System.currentTimeMillis() - started).coerceAtLeast(0)
                streamHooks.onToolStatus(toolLabel, operation, "done")
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

    companion object {
        private val LOCAL_TOOL_NAMES = setOf("atx_function", "atxfinance", "yahoo_finance")
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
