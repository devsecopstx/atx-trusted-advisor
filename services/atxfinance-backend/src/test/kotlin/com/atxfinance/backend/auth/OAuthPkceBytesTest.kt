package com.atxfinance.backend.auth

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class OAuthPkceBytesTest {
    @Test
    fun `S256 challenge is url-safe base64 without padding`() {
        val v = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        val c = OAuthPkceBytes.createCodeChallengeS256(v)
        assertTrue(c.isNotEmpty() && !c.contains("="))
        assertTrue(Regex("^[A-Za-z0-9_-]+$").matches(c))
        assertEquals(
            OAuthPkceBytes.createCodeChallengeS256(v),
            OAuthPkceBytes.createCodeChallengeS256(v),
        )
    }

    @Test
    fun `state and verifier are urlsafe and distinct`() {
        val s = OAuthPkceBytes.createOAuthState()
        val v = OAuthPkceBytes.createCodeVerifier()
        assertTrue(s.isNotEmpty() && v.isNotEmpty())
        assertNotEquals(s, v)
        assertTrue(Regex("^[A-Za-z0-9_-]+$").matches(s))
        assertTrue(Regex("^[A-Za-z0-9_-]+$").matches(v))
    }
}
