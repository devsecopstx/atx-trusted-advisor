package com.atxfinance.backend.web

import com.atxfinance.backend.auth.OAuthPkceBytes
import com.atxfinance.backend.auth.OAuthPkceRedisStore
import com.atxfinance.backend.config.AtxfinanceProperties
import jakarta.servlet.http.HttpServletRequest
import org.springframework.beans.factory.ObjectProvider
import org.springframework.core.env.Environment
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * PLAN 600 — Spring OAuth start: PKCE + optional Redis verifier store (dual-run with Next).
 * BFF does not proxy this path by default; enable when cutting Spring-primary auth.
 */
@RestController
class AuthLoginController(
    private val env: Environment,
    private val props: AtxfinanceProperties,
    private val pkceStore: ObjectProvider<OAuthPkceRedisStore>,
) {
    @GetMapping("/api/auth/x/login")
    fun login(
        request: HttpServletRequest,
        @RequestParam(name = "next", required = false) next: String?,
    ): ResponseEntity<Unit> {
        val clientId = env.getProperty("X_OAUTH_CLIENT_ID")?.trim()
        if (clientId.isNullOrEmpty()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build()
        }

        val origin = resolveOrigin(request)
        val callbackUrl =
            when {
                env.getProperty("NODE_ENV") == "production" -> {
                    val configured = env.getProperty("X_OAUTH_CALLBACK_URL")?.trim()
                    if (!configured.isNullOrEmpty()) configured else "$origin/api/auth/x/callback"
                }
                else -> "$origin/api/auth/x/callback"
            }
        val authorizeUrl = env.getProperty("X_OAUTH_AUTHORIZE_URL")?.trim() ?: "https://twitter.com/i/oauth2/authorize"

        val state = OAuthPkceBytes.createOAuthState()
        val verifier = OAuthPkceBytes.createCodeVerifier()
        val challenge = OAuthPkceBytes.createCodeChallengeS256(verifier)

        pkceStore.ifAvailable?.save(state, verifier)

        val scope = "tweet.read users.read users.email offline.access"
        val url =
            buildString {
                append(authorizeUrl)
                append("?response_type=code")
                append("&client_id=").append(URLEncoder.encode(clientId, StandardCharsets.UTF_8))
                append("&redirect_uri=").append(URLEncoder.encode(callbackUrl, StandardCharsets.UTF_8))
                append("&scope=").append(URLEncoder.encode(scope, StandardCharsets.UTF_8))
                append("&state=").append(URLEncoder.encode(state, StandardCharsets.UTF_8))
                append("&code_challenge=").append(URLEncoder.encode(challenge, StandardCharsets.UTF_8))
                append("&code_challenge_method=S256")
            }

        val secure = env.getProperty("NODE_ENV") == "production"
        val maxAge = props.redis.oauthFlowCookieMaxAgeSeconds.coerceIn(300, 7200)
        val headers = HttpHeaders()
        headers.add(HttpHeaders.SET_COOKIE, oauthCookie("xf_x_oauth_state", state, maxAge, secure))
        headers.add(HttpHeaders.SET_COOKIE, oauthCookie("xf_x_oauth_verifier", verifier, maxAge, secure))
        val nextTrim = next?.trim()
        if (!nextTrim.isNullOrEmpty() && isSafeReturnPath(nextTrim)) {
            headers.add(HttpHeaders.SET_COOKIE, oauthCookie("xf_oauth_return", nextTrim, maxAge, secure))
        }

        return ResponseEntity
            .status(HttpStatus.FOUND)
            .headers(headers)
            .location(URI.create(url))
            .build()
    }

    private fun oauthCookie(name: String, value: String, maxAge: Int, secure: Boolean): String {
        val sec = if (secure) "; Secure" else ""
        return "$name=$value; Path=/; HttpOnly; SameSite=Lax; Max-Age=$maxAge$sec"
    }

    private fun resolveOrigin(request: HttpServletRequest): String {
        val forwardedProto = request.getHeader("X-Forwarded-Proto")
        val forwardedHost = request.getHeader("X-Forwarded-Host")
        if (!forwardedHost.isNullOrBlank()) {
            val scheme = forwardedProto?.trim()?.takeIf { it.isNotEmpty() } ?: "https"
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

    private fun isSafeReturnPath(path: String): Boolean {
        val t = path.trim()
        if (!t.startsWith("/") || t.startsWith("//")) {
            return false
        }
        if (t.contains("..")) {
            return false
        }
        if (t.length > 512) {
            return false
        }
        if (Regex("[\r\n\u0000]").containsMatchIn(t)) {
            return false
        }
        return true
    }
}
