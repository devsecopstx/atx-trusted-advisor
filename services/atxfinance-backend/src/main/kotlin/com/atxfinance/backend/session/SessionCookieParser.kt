package com.atxfinance.backend.session

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Component
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

data class ResolvedSession(
    val userId: String,
    val tenantId: String,
)

@Component
class SessionCookieParser(
    private val authEnvSecrets: AuthEnvSecrets,
) {
    private val objectMapper = ObjectMapper()

    fun resolveSessionUser(cookieHeader: String?, cookieName: String): ResolvedSession? {
        val raw = extractCookieValue(cookieHeader, cookieName) ?: return null
        val parts = raw.split(".", limit = 3)
        if (parts.size != 2) {
            return null
        }
        val encodedPayload = parts[0]
        val signature = parts[1]
        val secret = authEnvSecrets.sessionSigningSecret()?.takeIf { it.isNotBlank() } ?: return null
        val expected = sign(encodedPayload, secret)
        if (!constantTimeEquals(signature, expected)) {
            return null
        }
        val json = String(Base64.getUrlDecoder().decode(encodedPayload), StandardCharsets.UTF_8)
        val node = try {
            objectMapper.readTree(json)
        } catch (_: Exception) {
            return null
        }
        val userId = node.get("userId")?.asText()?.trim().orEmpty()
        val tenantId = node.get("tenantId")?.asText()?.trim().orEmpty()
        val exp = node.get("exp")?.asLong(0L) ?: 0L
        if (exp <= System.currentTimeMillis()) {
            return null
        }
        if (userId.isBlank() || tenantId.isBlank()) {
            return null
        }
        return ResolvedSession(userId = userId, tenantId = tenantId)
    }

    companion object {
        fun sign(encodedPayload: String, secret: String): String {
            val mac = Mac.getInstance("HmacSHA256")
            mac.init(SecretKeySpec(secret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256"))
            val digest = mac.doFinal(encodedPayload.toByteArray(StandardCharsets.UTF_8))
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
        }

        fun extractCookieValue(cookieHeader: String?, name: String): String? {
            if (cookieHeader.isNullOrBlank()) {
                return null
            }
            val needle = "$name="
            for (part in cookieHeader.split(";")) {
                val trimmed = part.trim()
                if (trimmed.startsWith(needle)) {
                    return trimmed.substring(needle.length).trim()
                }
            }
            return null
        }

        private fun constantTimeEquals(a: String, b: String): Boolean {
            val ab = a.toByteArray(StandardCharsets.UTF_8)
            val bb = b.toByteArray(StandardCharsets.UTF_8)
            if (ab.size != bb.size) {
                // still do work to reduce timing leak on length
                return MessageDigest.isEqual(ab, ab) && false
            }
            return MessageDigest.isEqual(ab, bb)
        }
    }
}
