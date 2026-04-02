package com.atxfinance.backend.config

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class AtxRedisUriResolverTest {
    @Test
    fun `forcePlainFromEnv matches Next REDIS_TLS false variants`() {
        assertTrue(AtxRedisUriResolver.forcePlainFromEnv("false"))
        assertTrue(AtxRedisUriResolver.forcePlainFromEnv("OFF"))
        assertFalse(AtxRedisUriResolver.forcePlainFromEnv("true"))
        assertFalse(AtxRedisUriResolver.forcePlainFromEnv(null))
    }

    @Test
    fun `resolveConnectionUrl downgrades rediss when forcing plain`() {
        val u = AtxRedisUriResolver.resolveConnectionUrl("rediss://h:6379", tlsPlainWithRediss = true, envTls = null)
        assertEquals("redis://h:6379", u)
    }

    @Test
    fun `parseStandalone detects ssl from scheme`() {
        val plain = AtxRedisUriResolver.parseStandalone("redis://:secret@10.0.0.3:6379/0")
        assertFalse(plain.useSsl)
        assertEquals("10.0.0.3", plain.host)
        assertEquals(6379, plain.port)
        assertEquals("secret", plain.password)

        val tls = AtxRedisUriResolver.parseStandalone("rediss://default:pw@memorystore:11091")
        assertTrue(tls.useSsl)
        assertEquals("memorystore", tls.host)
        assertEquals(11091, tls.port)
    }
}
