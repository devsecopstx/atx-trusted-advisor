package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.task.TaskExecutor
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.util.concurrent.TimeUnit

/**
 * SSE plumbing for future xChat tool-loop streaming. Stub emits **meta** + **done** events shaped like
 * Next `POST /api/xchat/ask/stream` (post-loop transport) so clients can parse one code path before JVM streams tokens.
 */
@RestController
class XchatAskStreamController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    @Qualifier("schedulerTaskExecutor") private val taskExecutor: TaskExecutor,
    private val objectMapper: ObjectMapper,
) {
    /**
     * BFF registry / smoke parity documents: @PostMapping("/api/xchat/ask/stream")
     */
    @PostMapping("/api/xchat/ask/stream", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun askStream(request: HttpServletRequest): SseEmitter {
        sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED)

        val emitter = SseEmitter(TimeUnit.MINUTES.toMillis(5))
        taskExecutor.execute {
            try {
                val meta =
                    mapOf(
                        "v" to 1,
                        "phase" to "jvm_stub",
                        "threadId" to "",
                        "model" to "",
                        "personaId" to "",
                        "sourcesUsed" to 0,
                        "message" to "JVM SSE stub — use Next BFF for full post-loop stream until tool-loop is wired here",
                    )
                val done =
                    mapOf(
                        "model" to "",
                        "personaName" to "",
                        "contextCount" to 0,
                        "contextSource" to "none",
                        "interactionMeta" to
                            mapOf(
                                "generationMs" to 0,
                                "sources" to
                                    mapOf(
                                        "ragChunks" to 0,
                                        "toolInvocations" to 0,
                                        "personaCollections" to 0,
                                        "total" to 0,
                                    ),
                            ),
                        "metadata" to
                            mapOf(
                                "durationMs" to 0,
                                "sourcesUsed" to 0,
                                "personaId" to "",
                                "model" to "",
                                "threadId" to "",
                            ),
                        "jvmStub" to true,
                    )
                emitter.send(
                    SseEmitter.event()
                        .name("meta")
                        .data(objectMapper.writeValueAsString(meta)),
                )
                emitter.send(
                    SseEmitter.event()
                        .name("done")
                        .data(objectMapper.writeValueAsString(done)),
                )
                emitter.complete()
            } catch (ex: Exception) {
                emitter.completeWithError(ex)
            }
        }
        return emitter
    }
}
