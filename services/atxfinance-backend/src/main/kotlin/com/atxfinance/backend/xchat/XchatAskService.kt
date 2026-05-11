package com.atxfinance.backend.xchat

import com.atxfinance.backend.audit.AuditEventService
import com.atxfinance.backend.persona.PersonaService
import com.atxfinance.backend.session.ResolvedSession
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.stereotype.Service
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.nio.charset.StandardCharsets
import java.util.UUID

@Service
class XchatAskService(
    private val atxFunctionExecutor: AtxFunctionExecutor,
    private val personaService: PersonaService,
    private val auditEventService: AuditEventService,
    private val xaiToolLoopService: XaiToolLoopService,
    private val xchatRagContextService: XchatRagContextService,
) {
    fun streamAsk(
        request: HttpServletRequest,
        session: ResolvedSession,
        emitter: SseEmitter,
        objectMapper: ObjectMapper,
        usage: XchatUsageLimitResult,
    ) {
        val startedAt = System.currentTimeMillis()
        val requestId = UUID.randomUUID().toString()
        try {
            if (session.userId.isBlank() || session.tenantId.isBlank()) {
                error("session_scope_invalid")
            }
            val body = readRequestBody(request)
            val root = parseRequestJson(body, objectMapper)
            val message = root.path("message").asText("").trim()
            val threadId = resolveThreadId(root)
            val persona = resolvePersona(root)
            val personaId = persona?.getObjectId("_id")?.toHexString() ?: root.path("personaId").asText("advisor")
            val model = XchatPersonaSupport.model(persona, "grok-4-1-fast-reasoning")
            val executionContext =
                AtxFunctionExecutionContext(
                    session = session,
                    portfolioIdHex = root.path("portfolioId").asText("").trim().takeIf { it.isNotEmpty() },
                    workspacePreload = parseWorkspacePreload(root, objectMapper),
                )

            emit(emitter, "meta", objectMapper) {
                mapOf(
                    "v" to 1,
                    "phase" to "live_tool_loop",
                    "threadId" to threadId,
                    "model" to model,
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
                        markdownProvider = {
                            atxFunctionExecutor.executeOptionsActionScan(executionContext).let { it.markdown to it.donePayload }
                        },
                    )
                    writeTurnAudit(
                        session = session,
                        requestId = requestId,
                        action = "xchat_options_action_scan_spring",
                        details =
                            mapOf(
                                "threadId" to threadId,
                                "personaId" to personaId,
                                "usageMinute" to usage.observedMinuteCount,
                                "usageDay" to usage.observedDayCount,
                            ),
                    )
                }
                XchatAskRouting.isShowWatchlistIntent(message) -> {
                    streamDirectToolPath(
                        emitter = emitter,
                        objectMapper = objectMapper,
                        operation = "watchlist_snapshot",
                        turnIndex = 0,
                        markdownProvider = {
                            atxFunctionExecutor.executeWatchlistSnapshot(executionContext).let { it.markdown to it.donePayload }
                        },
                    )
                    writeTurnAudit(
                        session = session,
                        requestId = requestId,
                        action = "xchat_watchlist_snapshot_spring",
                        details =
                            mapOf(
                                "threadId" to threadId,
                                "personaId" to personaId,
                                "usageMinute" to usage.observedMinuteCount,
                                "usageDay" to usage.observedDayCount,
                            ),
                    )
                }
                else -> {
                    streamToolLoopPath(
                        emitter = emitter,
                        objectMapper = objectMapper,
                        message = message,
                        persona = persona,
                        personaId = personaId,
                        model = model,
                        executionContext = executionContext,
                        startedAt = startedAt,
                    )
                    writeTurnAudit(
                        session = session,
                        requestId = requestId,
                        action = "xchat_ask_spring_tool_loop",
                        details =
                            mapOf(
                                "threadId" to threadId,
                                "personaId" to personaId,
                                "usageMinute" to usage.observedMinuteCount,
                                "usageDay" to usage.observedDayCount,
                            ),
                    )
                }
            }

            emit(
                emitter,
                "provider",
                objectMapper,
            ) {
                mapOf(
                    "handler" to "spring_xchat_phase2",
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

    private fun resolvePersona(root: JsonNode) =
        root.path("personaId").asText("").trim().takeIf { it.isNotEmpty() }?.let { personaId ->
            if (ObjectId.isValid(personaId)) {
                personaService.getPersonaById(personaId)
            } else {
                null
            }
        }

    private fun writeTurnAudit(
        session: ResolvedSession,
        requestId: String,
        action: String,
        details: Map<String, Any?>,
    ) {
        runCatching {
            auditEventService.insertEvent(
                entityType = "xchat_session",
                entityId = requestId,
                action = action,
                session = session,
                details = details,
            )
        }
    }

    private fun streamToolLoopPath(
        emitter: SseEmitter,
        objectMapper: ObjectMapper,
        message: String,
        persona: Document?,
        personaId: String,
        model: String,
        executionContext: AtxFunctionExecutionContext,
        startedAt: Long,
    ) {
        if (message.isBlank()) {
            emit(emitter, "error", objectMapper) {
                mapOf(
                    "message" to "message is required",
                    "code" to "message_required",
                )
            }
            return
        }
        val (ragContext, ragChunkCount) = xchatRagContextService.buildRagContext(message, persona)
        val systemPrompt =
            buildString {
                append(XchatPersonaSupport.systemPrompt(persona))
                if (ragContext.isNotBlank()) {
                    appendLine()
                    appendLine()
                    append(ragContext)
                }
            }
        val loopResult =
            xaiToolLoopService.runLoop(
                model = model,
                systemPrompt = systemPrompt,
                userPrompt = message,
                tools = XchatPersonaSupport.wireTools(persona),
                toolChoice = XchatPersonaSupport.toolChoice(persona),
                maxTurns = XchatPersonaSupport.maxTurns(persona),
                executionContext = executionContext,
                streamHooks =
                    XaiToolLoopService.StreamHooks(
                        onTurnStart = { turnIndex ->
                            emit(emitter, "turn", objectMapper) { mapOf("index" to turnIndex) }
                        },
                        onToolStatus = { tool, operation, status ->
                            emit(emitter, "tool_status", objectMapper) {
                                mapOf(
                                    "tool" to tool,
                                    "operation" to operation,
                                    "status" to status,
                                )
                            }
                        },
                    ),
            )
        val output = loopResult.outputText.ifBlank { "No response from xAI." }
        for (chunk in chunkUtf16PreservingPairs(output, 140)) {
            emit(emitter, "delta", objectMapper) { mapOf("c" to chunk) }
        }
        val personaCollections = XchatPersonaSupport.linkedCollectionIds(persona).size
        emit(emitter, "done", objectMapper) {
            mapOf(
                "response" to output,
                "model" to loopResult.model,
                "personaName" to (persona?.getString("name") ?: personaId),
                "contextCount" to ragChunkCount,
                "contextSource" to if (ragChunkCount > 0) "rag_documents_search" else "none",
                "collectionSearchStatus" to if (ragChunkCount > 0) "ok" else "skipped_no_collections",
                "toolCalls" to loopResult.toolCalls,
                "interactionMeta" to
                    mapOf(
                        "generationMs" to (System.currentTimeMillis() - startedAt).coerceAtLeast(0),
                        "turnsUsed" to loopResult.turnsUsed,
                        "sources" to
                            mapOf(
                                "ragChunks" to ragChunkCount,
                                "toolInvocations" to loopResult.toolCalls.size,
                                "personaCollections" to personaCollections,
                                "total" to ragChunkCount + loopResult.toolCalls.size,
                            ),
                    ),
            )
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun parseWorkspacePreload(root: JsonNode, objectMapper: ObjectMapper): Map<String, Any?>? {
        val node = root.get("workspacePreload") ?: return null
        if (node.isNull) {
            return null
        }
        return objectMapper.convertValue(node, Map::class.java) as Map<String, Any?>
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
