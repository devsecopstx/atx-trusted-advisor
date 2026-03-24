package com.atxfinance.backend.session

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Creates the byte-compatible xf_core_session cookie signed with AUTH_SECRET or X_OAUTH_CLIENT_SECRET.
 * Matches Next.js createSession / SessionCookieParser format.
 */
@Component
class SessionCookieWriter(
    private val authEnvSecrets: AuthEnvSecrets,
) {
    private val objectMapper = ObjectMapper()

    fun createSessionCookie(payload: SessionPayload): String? {
        val secret = authEnvSecrets.sessionSigningSecret()?.takeIf { it.isNotBlank() } ?: return null
        val json = objectMapper.writeValueAsString(payload)
        val encodedPayload = Base64.getUrlEncoder().withoutPadding().encodeToString(json.toByteArray(StandardCharsets.UTF_8))
        val signature = SessionCookieParser.sign(encodedPayload, secret)
        return "$encodedPayload.$signature"
    }

    data class SessionPayload(
        val userId: String,
        val email: String,
        val roles: List<String>,
        val tenantId: String,
        val tenantRole: String,
        val xUserId: String?,
        val username: String?,
        val displayName: String?,
        val avatarUrl: String?,
        val exp: Long,
    )
}
