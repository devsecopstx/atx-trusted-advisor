package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.isGlobalAdmin
import com.atxfinance.backend.xchat.XchatAskService
import com.atxfinance.backend.xchat.XchatSseLimitHeaders
import com.atxfinance.backend.xchat.XchatUsageLimitInput
import com.atxfinance.backend.xchat.XchatUsageLimitService
import com.atxfinance.backend.xchat.XchatWorkspaceLimitsResolver
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.util.concurrent.TimeUnit

@RestController
class XchatAskStreamController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val xchatAskService: XchatAskService,
    private val xchatUsageLimitService: XchatUsageLimitService,
    private val xchatWorkspaceLimitsResolver: XchatWorkspaceLimitsResolver,
    private val objectMapper: ObjectMapper,
) {
    @PostMapping("/api/xchat/ask/stream", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun askStream(
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): SseEmitter {
        val session =
            sessionCookieParser.resolveSessionUser(
                request.getHeader("Cookie"),
                props.sessionCookieName,
            ) ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED)

        val caps = xchatWorkspaceLimitsResolver.resolveForSession(session)
        val usage =
            xchatUsageLimitService.enforceDistributedAskUsageLimit(
                XchatUsageLimitInput(
                    userId = session.userId,
                    tenantId = session.tenantId,
                    subscriptionPlan = caps.subscriptionPlan,
                    perMinuteLimit = props.xchatAskPerMinuteLimit,
                    enforceDailyLimit = !session.isGlobalAdmin(),
                    dailyPromptLimit = caps.dailyPromptLimit,
                    hourlyPromptLimit = caps.hourlyPromptLimit,
                ),
            )
        applyLimitHeaders(response, usage)
        if (!usage.allowed) {
            response.status = HttpStatus.TOO_MANY_REQUESTS.value()
            response.contentType = MediaType.APPLICATION_JSON_VALUE
            val body =
                mapOf(
                    "error" to XchatSseLimitHeaders.limitErrorMessage(usage.code),
                    "code" to usage.code,
                )
            throw ResponseStatusException(
                HttpStatus.TOO_MANY_REQUESTS,
                objectMapper.writeValueAsString(body),
            )
        }

        response.setHeader("Cache-Control", "no-cache, no-transform")
        response.setHeader("Connection", "keep-alive")
        response.setHeader("X-Accel-Buffering", "no")

        val emitter = SseEmitter(TimeUnit.MINUTES.toMillis(10))
        Thread.ofVirtual().start {
            try {
                xchatAskService.streamAsk(request, session, emitter, objectMapper, usage)
            } catch (ex: Exception) {
                emitter.completeWithError(ex)
            }
        }
        return emitter
    }

    private fun applyLimitHeaders(
        response: HttpServletResponse,
        usage: com.atxfinance.backend.xchat.XchatUsageLimitResult,
    ) {
        val headers = org.springframework.http.HttpHeaders()
        XchatSseLimitHeaders.apply(headers, usage)
        headers.forEach { name, values ->
            values.forEach { value -> response.setHeader(name, value) }
        }
    }

}
