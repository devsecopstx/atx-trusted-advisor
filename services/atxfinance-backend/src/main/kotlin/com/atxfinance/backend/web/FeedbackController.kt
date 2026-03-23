package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.notify.SlackWebhookService
import com.atxfinance.backend.session.SessionCookieParser
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class FeedbackController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val slackWebhookService: SlackWebhookService,
    private val objectMapper: ObjectMapper,
) {

    @PostMapping("/api/feedback")
    fun post(
        request: HttpServletRequest,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON"))
        }
        val message = (body["message"] as? String)?.trim() ?: ""
        if (message.length < 3 || message.length > 4000) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid payload"))
        }
        val page = (body["page"] as? String)?.trim()?.take(500)
        val who = session.username?.takeIf { it.isNotBlank() }?.let { "@$it" } ?: (session.email ?: session.userId)
        val slack = mapOf(
            "text" to "💬 atxFinance app feedback${page?.let { " • $it" } ?: ""} — $who (${session.userId})",
            "blocks" to listOf(
                mapOf(
                    "type" to "header",
                    "text" to mapOf("type" to "plain_text", "text" to "💬 App user feedback"),
                ),
                mapOf(
                    "type" to "section",
                    "fields" to listOf(
                        mapOf(
                            "type" to "mrkdwn",
                            "text" to "*Who:*\n$who (${session.email ?: ""})",
                        ),
                        mapOf(
                            "type" to "mrkdwn",
                            "text" to "*User ID:*\n`${session.userId}`",
                        ),
                    ),
                ),
                mapOf(
                    "type" to "section",
                    "text" to mapOf(
                        "type" to "mrkdwn",
                        "text" to "*Message:*\n${message.take(2800)}",
                    ),
                ),
            ),
        )
        slackWebhookService.postJson(objectMapper.writeValueAsString(slack))
        return ResponseEntity.status(HttpStatus.CREATED).body(mapOf("ok" to true))
    }
}
