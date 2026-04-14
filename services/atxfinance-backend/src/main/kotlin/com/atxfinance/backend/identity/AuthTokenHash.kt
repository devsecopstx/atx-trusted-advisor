package com.atxfinance.backend.identity

import java.security.MessageDigest

/** SHA-256 hex of UTF-8 raw invite/reset token — matches Next.js `hashAuthLookupToken`. */
object AuthTokenHash {
    fun sha256HexOfUtf8(rawToken: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(rawToken.toByteArray(Charsets.UTF_8))
        return hash.joinToString("") { b -> "%02x".format(b) }
    }
}
