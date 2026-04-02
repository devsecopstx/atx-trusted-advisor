package com.atxfinance.backend.config

import java.net.URI

internal object AtxRedisUriResolver {
    /** Match Next `REDIS_TLS=false` against misconfigured `rediss://` endpoints. */
    fun forcePlainFromEnv(envTls: String?): Boolean {
        val v = envTls?.trim()?.lowercase() ?: return false
        return v == "false" || v == "0" || v == "off" || v == "no"
    }

    fun resolveConnectionUrl(raw: String, tlsPlainWithRediss: Boolean, envTls: String?): String {
        var u = raw.trim()
        if ((tlsPlainWithRediss || forcePlainFromEnv(envTls)) && u.startsWith("rediss://")) {
            u = "redis://" + u.removePrefix("rediss://")
        }
        return u
    }

    fun parseStandalone(url: String): RedisStandaloneTarget {
        val resolved = URI(url)
        val host = resolved.host ?: error("Redis URL missing host")
        val port = if (resolved.port > 0) resolved.port else 6379
        val userInfo = resolved.userInfo
        val password = userInfo?.substringAfter(":", "")?.takeIf { it.isNotEmpty() }
        val username = userInfo?.substringBefore(":", "")?.takeIf { it.isNotEmpty() }
        val useSsl = url.startsWith("rediss://")
        return RedisStandaloneTarget(
            host = host,
            port = port,
            username = username,
            password = password,
            useSsl = useSsl,
        )
    }

    data class RedisStandaloneTarget(
        val host: String,
        val port: Int,
        val username: String?,
        val password: String?,
        val useSsl: Boolean,
    )
}
