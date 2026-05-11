package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.xchat.XchatAskService
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.util.concurrent.TimeUnit

/**
 * Phase 1: Spring xChat SSE with full event parity.
 */
@RestController
class XchatAskStreamController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val xchatAskService: XchatAskService,
    private val objectMapper: ObjectMapper,
) {

    @PostMapping("/api/xchat/ask/stream", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun askStream(request: HttpServletRequest): SseEmitter {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: throw ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED)

        val emitter = SseEmitter(TimeUnit.MINUTES.toMillis(10))

        Thread.ofVirtual().start {
            try {
                xchatAskService.streamAsk(request, session, emitter, objectMapper)
            } catch (ex: Exception) {
                emitter.completeWithError(ex)
            }
        }
        return emitter
    }
}