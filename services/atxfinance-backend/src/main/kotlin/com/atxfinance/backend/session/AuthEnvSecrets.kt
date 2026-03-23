package com.atxfinance.backend.session

import org.springframework.core.env.Environment
import org.springframework.stereotype.Component

/**
 * Matches Next.js [getSigningSecret]: AUTH_SECRET when set, else X_OAUTH_CLIENT_SECRET.
 */
@Component
class AuthEnvSecrets(
    private val env: Environment,
) {
    fun sessionSigningSecret(): String? {
        val auth = env.getProperty("AUTH_SECRET")?.trim()?.takeIf { it.isNotEmpty() }
        if (auth != null) {
            return auth
        }
        return env.getProperty("X_OAUTH_CLIENT_SECRET")?.trim()?.takeIf { it.isNotEmpty() }
    }
}
