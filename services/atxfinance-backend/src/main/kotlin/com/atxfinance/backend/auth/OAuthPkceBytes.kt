package com.atxfinance.backend.auth

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

internal object OAuthPkceBytes {
    private val rnd = SecureRandom()

    fun createOAuthState(): String {
        val b = ByteArray(24)
        rnd.nextBytes(b)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b)
    }

    fun createCodeVerifier(): String {
        val b = ByteArray(48)
        rnd.nextBytes(b)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b)
    }

    fun createCodeChallengeS256(verifier: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.UTF_8))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest)
    }
}
