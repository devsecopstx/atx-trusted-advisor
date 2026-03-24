package com.atxfinance.backend.web

import com.atxfinance.backend.auth.OAuthCallbackService
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * OAuth callback — issues session cookie and redirects.
 * Dual-run: Next /api/auth/x/login sets PKCE cookies; this controller reads them.
 * Add to BFF_PROXY_ROUTES and enable via AUTH_CALLBACK_USE_SPRING when ready.
 */
@RestController
class AuthCallbackController(
    private val oauthCallbackService: OAuthCallbackService,
) {
    @GetMapping("/api/auth/x/callback")
    fun callback(
        @RequestParam code: String?,
        @RequestParam state: String?,
        request: HttpServletRequest,
    ): ResponseEntity<Unit> {
        val codeVal = code?.trim().orEmpty()
        val stateVal = state?.trim().orEmpty()

        val origin = resolveOrigin(request)
        val callbackUrl = "$origin/api/auth/x/callback"
        val cookieHeader = request.getHeader("Cookie")

        val stateFromCookie = parseCookie(cookieHeader, "xf_x_oauth_state")
        val verifierFromCookie = parseCookie(cookieHeader, "xf_x_oauth_verifier")

        return oauthCallbackService.handleCallback(
            code = codeVal,
            state = stateVal,
            stateFromCookie = stateFromCookie,
            verifierFromCookie = verifierFromCookie,
            callbackUrl = callbackUrl,
            origin = origin,
            cookieHeader = cookieHeader,
        )
    }

    private fun resolveOrigin(request: HttpServletRequest): String {
        val forwardedProto = request.getHeader("X-Forwarded-Proto")
        val forwardedHost = request.getHeader("X-Forwarded-Host")
        if (!forwardedHost.isNullOrBlank()) {
            val scheme = forwardedProto?.trim()?.takeIf { it.isNotBlank() } ?: "https"
            return "$scheme://$forwardedHost"
        }
        val scheme = request.scheme ?: "https"
        val host = request.serverName
        val port = request.serverPort
        return if (port in listOf(80, 443) || port <= 0) {
            "$scheme://$host"
        } else {
            "$scheme://$host:$port"
        }
    }

    private fun parseCookie(header: String?, name: String): String? {
        if (header.isNullOrBlank()) return null
        val needle = "$name="
        for (part in header.split(";")) {
            val trimmed = part.trim()
            if (trimmed.startsWith(needle)) {
                return trimmed.substring(needle.length).trim().takeIf { it.isNotEmpty() }
            }
        }
        return null
    }
}
