package com.atxfinance.backend.session

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.core.env.Environment
import java.nio.charset.StandardCharsets
import java.util.Base64

class SessionCookieParserTest {

    @Test
    fun `accepts signed payload matching Next session cookie format`() {
        val secret = "01234567890123456789012345678901"
        val env = mock(Environment::class.java)
        `when`(env.getProperty("AUTH_SECRET")).thenReturn(secret)
        `when`(env.getProperty("X_OAUTH_CLIENT_SECRET")).thenReturn(null)

        val exp = System.currentTimeMillis() + 3_600_000L
        val payloadJson =
            """{"userId":"64a1b2c3d4e5f67890123456","tenantId":"64a1b2c3d4e5f67890123457","email":"a@b.c","exp":$exp}"""
        val enc = Base64.getUrlEncoder().withoutPadding().encodeToString(
            payloadJson.toByteArray(StandardCharsets.UTF_8),
        )
        val sig = SessionCookieParser.sign(enc, secret)
        val cookieValue = "$enc.$sig"
        val header = "other=1; xf_core_session=$cookieValue; z=2"

        val parser = SessionCookieParser(AuthEnvSecrets(env))
        val resolved = parser.resolveSessionUser(header, "xf_core_session")
        assertNotNull(resolved)
        assertEquals("64a1b2c3d4e5f67890123456", resolved!!.userId)
        assertEquals("64a1b2c3d4e5f67890123457", resolved.tenantId)
    }

    @Test
    fun `rejects wrong signature`() {
        val secret = "01234567890123456789012345678901"
        val env = mock(Environment::class.java)
        `when`(env.getProperty("AUTH_SECRET")).thenReturn(secret)
        `when`(env.getProperty("X_OAUTH_CLIENT_SECRET")).thenReturn(null)

        val payloadJson = """{"userId":"u","tenantId":"t","exp":${System.currentTimeMillis() + 3600_000}}"""
        val enc = Base64.getUrlEncoder().withoutPadding().encodeToString(
            payloadJson.toByteArray(StandardCharsets.UTF_8),
        )
        val header = "xf_core_session=$enc.wrongsig"

        val parser = SessionCookieParser(AuthEnvSecrets(env))
        assertNull(parser.resolveSessionUser(header, "xf_core_session"))
    }
}
