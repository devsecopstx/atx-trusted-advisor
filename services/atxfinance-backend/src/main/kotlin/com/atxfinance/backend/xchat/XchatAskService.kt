package com.atxfinance.backend.xchat

import com.atxfinance.backend.session.ResolvedSession
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import org.springframework.stereotype.Service
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.nio.charset.StandardCharsets

@Service
class XchatAskService(
    private val atxFunctionExecutor: AtxFunctionExecutor,
) {
    fun streamAsk(
        request: HttpServletRequest,
        session: ResolvedSession,
        emitter: SseEmitter,
        objectMapper: ObjectMapper,
    ) {
        val startedAt = System.currentTimeMillis()
        try {
            val body = readRequestBody(request)
            val root = parseRequestJson(body, objectMapper)
            val message = root.path("message").asText("").trim()
            val threadId = resolveThreadId(root)
            val personaId = root.path("personaId").asText("advisor").ifBlank { "advisor" }

            checkUsageLimitsStub(session)

            emit(emitter, "meta", objectMapper) {
                mapOf(
                    "v" to 1,
                    "phase" to "live_tool_loop",
                    "threadId" to threadId,
                    "model" to "spring_phase1",
                    "personaId" to personaId,
                )
            }

            when {
                XchatAskRouting.shouldRunOptionsActionScan(message) -> {
                    streamDirectToolPath(
                        emitter = emitter,
                        objectMapper = objectMapper,
                        operation = "options_action_scan",
                        turnIndex = 0,
                        markdownProvider = { atxFunctionExecutor.executeOptionsActionScan(session).let { it.markdown to it.donePayload } },
                    )
                }
                XchatAskRouting.isShowWatchlistIntent(message) -> {
                    streamDirectToolPath(
                        emitter = emitter,
                        objectMapper = objectMapper,
                        operation = "watchlist_snapshot",
                        turnIndex = 0,
                        markdownProvider = { atxFunctionExecutor.executeWatchlistSnapshot(session).let { it.markdown to it.donePayload } },
                    )
                }
                else -> {
                    emit(
                        emitter,
                        "error",
                        objectMapper,
                    ) {
                        mapOf(
                            "message" to "Spring xChat Phase 1 supports direct options scan and watchlist intents only.",
                            "code" to "spring_xchat_phase1_unsupported_intent",
                        )
                    }
                }
            }

            emit(
                emitter,
                "provider",
                objectMapper,
            ) {
                mapOf(
                    "handler" to "spring_xchat_phase1",
                    "durationMs" to (System.currentTimeMillis() - startedAt).coerceAtLeast(0),
                )
            }
            emitter.complete()
        } catch (ex: Exception) {
            emit(
                emitter,
                "error",
                objectMapper,
            ) {
                mapOf(
                    "message" to (ex.message ?: "xchat_stream_failed"),
                    "code" to "spring_xchat_stream_failed",
                )
            }
            emitter.completeWithError(ex)
        }
    }

    private fun streamDirectToolPath(
        emitter: SseEmitter,
        objectMapper: ObjectMapper,
        operation: String,
        turnIndex: Int,
        markdownProvider: () -> Pair<String, Map<String, Any?>>,
    ) {
        emit(emitter, "turn", objectMapper) { mapOf("index" to turnIndex) }
        emit(emitter, "tool_status", objectMapper) {
            mapOf(
                "tool" to "atx_function",
                "operation" to operation,
                "status" to "running",
            )
        }
        val (markdown, donePayload) = markdownProvider()
        emit(emitter, "tool_status", objectMapper) {
            mapOf(
                "tool" to "atx_function",
                "operation" to operation,
                "status" to "done",
            )
        }
        for (chunk in chunkUtf16PreservingPairs(markdown, 140)) {
            emit(emitter, "delta", objectMapper) { mapOf("c" to chunk) }
        }
        emit(emitter, "done", objectMapper) { donePayload }
    }

    private fun checkUsageLimitsStub(session: ResolvedSession) {
        // Phase 2: port Next `ask-usage-limits.ts` distributed counters.
        if (session.userId.isBlank() || session.tenantId.isBlank()) {
            error("session_scope_invalid")
        }
    }

    private fun readRequestBody(request: HttpServletRequest): String {
        val bytes = request.inputStream.readBytes()
        if (bytes.isEmpty()) {
            return "{}"
        }
        return String(bytes, StandardCharsets.UTF_8)
    }

    private fun parseRequestJson(body: String, objectMapper: ObjectMapper): JsonNode =
        try {
            objectMapper.readTree(body.ifBlank { "{}" })
        } catch (_: Exception) {
            objectMapper.createObjectNode()
        }

    private fun resolveThreadId(root: JsonNode): String {
        val explicit = root.path("threadId").asText("").trim()
        if (explicit.isNotEmpty()) {
            return explicit
        }
        return "spring-${System.currentTimeMillis()}"
    }

    private fun emit(
        emitter: SseEmitter,
        event: String,
        objectMapper: ObjectMapper,
        data: () -> Map<String, Any?>,
    ) {
        val json = objectMapper.writeValueAsString(data())
        emitter.send(SseEmitter.event().name(event).data(json))
    }

    private fun chunkUtf16PreservingPairs(text: String, chunkChars: Int): List<String> {
        if (text.isEmpty() || chunkChars <= 0) {
            return emptyList()
        }
        val out = mutableListOf<String>()
        var i = 0
        while (i < text.length) {
            var end = (i + chunkChars).coerceAtMost(text.length)
            if (end < text.length && Character.isLowSurrogate(text[end])) {
                end -= 1
            }
            if (end <= i) {
                end = (i + 1).coerceAtMost(text.length)
            }
            out.add(text.substring(i, end))
            i = end
        }
        return out
    }
}
