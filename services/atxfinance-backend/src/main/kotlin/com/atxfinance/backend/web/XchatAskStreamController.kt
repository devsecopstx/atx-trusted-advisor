package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
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
 * SSE plumbing for future xChat tool-loop streaming. Emits a single **meta** event until the xAI stream is wired on JVM.
 */
@RestController
class XchatAskStreamController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    @Qualifier("schedulerTaskExecutor") private val taskExecutor: TaskExecutor,
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
                emitter.send(
                    SseEmitter.event()
                        .name("meta")
                        .data(
                            """{"phase":"stub","message":"SSE path ready; tool-loop streaming not implemented on JVM yet"}""",
                        ),
                )
                emitter.complete()
            } catch (ex: Exception) {
                emitter.completeWithError(ex)
            }
        }
        return emitter
    }
}
