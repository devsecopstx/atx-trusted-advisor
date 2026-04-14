package com.atxfinance.backend.identity

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class AuthTokenHashTest {
    @Test
    fun `sha256 matches Node createHash sha256 utf8 hex`() {
        // echo -n 'token-one' | shasum -a 256
        assertEquals(
            "75c5c10f256c75b650c6ffc2e83c6588af02766efd2de28f4de34547006e8d1a",
            AuthTokenHash.sha256HexOfUtf8("token-one"),
        )
    }
}
