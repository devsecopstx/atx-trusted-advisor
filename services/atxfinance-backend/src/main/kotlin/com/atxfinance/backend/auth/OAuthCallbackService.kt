package com.atxfinance.backend.auth

import com.atxfinance.backend.session.SessionCookieWriter
import com.atxfinance.backend.identity.OAuthIdentityService
import com.atxfinance.backend.portfolio.DefaultPortfolioProvisionService
import org.slf4j.LoggerFactory
import org.springframework.core.env.Environment
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Service
import org.springframework.web.client.RestTemplate
import java.net.URI
import java.util.Base64

/**
 * OAuth callback flow: exchange code for token, fetch userinfo, resolve/link user, issue session.
 * Dual-run: reads PKCE state+verifier from cookies (set by Next /api/auth/x/login).
 */
@Service
class OAuthCallbackService(
    private val restTemplate: RestTemplate,
    private val env: Environment,
    private val oauthIdentityService: OAuthIdentityService,
    private val defaultPortfolioProvisionService: DefaultPortfolioProvisionService,
    private val sessionCookieWriter: SessionCookieWriter,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun handleCallback(
        code: String,
        state: String,
        stateFromCookie: String?,
        verifierFromCookie: String?,
        callbackUrl: String,
        origin: String,
        cookieHeader: String?,
    ): ResponseEntity<Unit> {
        if (code.isBlank() || state.isBlank()) {
            return redirectToLogin(origin, "missing_oauth_callback_params")
        }
        if (stateFromCookie.isNullOrBlank() || verifierFromCookie.isNullOrBlank()) {
            return redirectToLogin(origin, "missing_oauth_cookie_context")
        }
        if (state != stateFromCookie) {
            return redirectToLogin(origin, "invalid_oauth_state")
        }

        val clientId = env.getProperty("X_OAUTH_CLIENT_ID")?.trim() ?: run {
            log.error("[auth/x/callback] X_OAUTH_CLIENT_ID missing")
            return redirectToLogin(origin, "generic")
        }
        val clientSecret = env.getProperty("X_OAUTH_CLIENT_SECRET")?.trim() ?: run {
            log.error("[auth/x/callback] X_OAUTH_CLIENT_SECRET missing")
            return redirectToLogin(origin, "generic")
        }
        val tokenUrl = env.getProperty("X_OAUTH_TOKEN_URL") ?: "https://api.x.com/2/oauth2/token"
        val userinfoUrl = env.getProperty("X_OAUTH_USERINFO_URL") ?: "https://api.x.com/2/users/me"

        val tokenResponse = restTemplate.postForEntity(
            tokenUrl,
            buildTokenRequest(code, callbackUrl, verifierFromCookie, clientId, clientSecret),
            Map::class.java,
        )
        if (!tokenResponse.statusCode.is2xxSuccessful || tokenResponse.body == null) {
            log.warn("[auth/x/callback] token exchange failed: {}", tokenResponse.statusCode)
            return redirectToLogin(origin, "token_exchange_failed")
        }
        val accessToken = (tokenResponse.body as Map<*, *>)["access_token"] as? String
        if (accessToken.isNullOrBlank()) {
            return redirectToLogin(origin, "missing_access_token")
        }

        val userinfo = fetchUserInfo(accessToken, userinfoUrl) ?: run {
            return redirectToLogin(origin, "userinfo_failed")
        }
        val xUserId = userinfo["id"] as? String ?: run {
            return redirectToLogin(origin, "invalid_user_profile")
        }
        val username = userinfo["username"] as? String ?: run {
            return redirectToLogin(origin, "invalid_user_profile")
        }
        val emailFromProvider = (userinfo["email"] as? String)?.trim()?.lowercase()
        val displayName = userinfo["name"] as? String
        val avatarUrl = (userinfo["profile_image_url"] as? String)?.trim()?.takeIf { it.isNotBlank() }

        val authContext = try {
            oauthIdentityService.resolveOrCreateUserFromOAuth(
                xUserId = xUserId,
                username = username,
                displayName = displayName,
                avatarUrl = avatarUrl,
                emailFromProvider = emailFromProvider,
            )
        } catch (e: Exception) {
            log.error("[auth/x/callback] identity bootstrap failed", e)
            return redirectToLogin(origin, "bootstrap_failed")
        }
        if (authContext == null) {
            return redirectToLogin(origin, "access_request_pending")
        }

        try {
            defaultPortfolioProvisionService.provisionForUser(
                authContext.userId.toHexString(),
                authContext.tenantId.toHexString(),
            )
        } catch (e: Exception) {
            log.warn("[auth/x/callback] default portfolio provision non-fatal: {}", e.message)
        }

        val exp = System.currentTimeMillis() + SESSION_TTL_SECONDS * 1000
        val sessionPayload = SessionCookieWriter.SessionPayload(
            userId = authContext.userId.toHexString(),
            email = authContext.email,
            roles = authContext.roles,
            tenantId = authContext.tenantId.toHexString(),
            tenantRole = authContext.tenantRole,
            xUserId = authContext.xUserId,
            username = authContext.username,
            displayName = authContext.displayName,
            avatarUrl = authContext.avatarUrl,
            exp = exp,
        )
        val cookieValue = sessionCookieWriter.createSessionCookie(sessionPayload)
        if (cookieValue == null) {
            log.error("[auth/x/callback] failed to create session cookie (missing signing secret)")
            return redirectToLogin(origin, "generic")
        }

        val sessionCookieName = env.getProperty("app.atxfinance.session-cookie-name") ?: "xf_core_session"
        val redirectTo = if (authContext.roles.any { it == "global_admin" }) "/admin" else "/xchat"
        val location = URI.create("$origin$redirectTo")

        return ResponseEntity
            .status(HttpStatus.FOUND)
            .location(location)
            .header(HttpHeaders.SET_COOKIE, buildSetCookieHeader(sessionCookieName, cookieValue))
            .build()
    }

    private fun buildTokenRequest(
        code: String,
        redirectUri: String,
        codeVerifier: String,
        clientId: String,
        clientSecret: String,
    ): org.springframework.http.HttpEntity<*> {
        val body = org.springframework.util.LinkedMultiValueMap<String, String>().apply {
            add("grant_type", "authorization_code")
            add("code", code)
            add("redirect_uri", redirectUri)
            add("code_verifier", codeVerifier)
        }
        val auth = Base64.getEncoder().encodeToString("$clientId:$clientSecret".toByteArray(Charsets.UTF_8))
        val headers = HttpHeaders().apply {
            contentType = MediaType.APPLICATION_FORM_URLENCODED
            set("Authorization", "Basic $auth")
        }
        return org.springframework.http.HttpEntity(body, headers)
    }

    private fun fetchUserInfo(accessToken: String, userinfoUrl: String): Map<String, Any>? {
        return try {
            val headers = HttpHeaders().apply {
                set("Authorization", "Bearer $accessToken")
            }
            val entity = org.springframework.http.HttpEntity<Unit>(headers)
            val response = restTemplate.exchange(
                userinfoUrl,
                org.springframework.http.HttpMethod.GET,
                entity,
                Map::class.java,
            )
            if (response.statusCode.is2xxSuccessful && response.body != null) {
                val body = response.body as Map<*, *>
                val data = body["data"] as? Map<*, *> ?: body
                @Suppress("UNCHECKED_CAST")
                data as? Map<String, Any>
            } else null
        } catch (e: Exception) {
            log.warn("[auth/x/callback] userinfo fetch failed: {}", e.message)
            null
        }
    }

    private fun redirectToLogin(origin: String, error: String): ResponseEntity<Unit> {
        val location = URI.create("$origin/login?error=$error")
        return ResponseEntity.status(HttpStatus.FOUND).location(location).build()
    }

    private fun buildSetCookieHeader(name: String, value: String): String {
        val maxAge = SESSION_TTL_SECONDS
        val secure = env.getProperty("NODE_ENV") == "production"
        return "$name=$value; Path=/; HttpOnly; SameSite=Lax; Max-Age=$maxAge${if (secure) "; Secure" else ""}"
    }

    companion object {
        private const val SESSION_TTL_SECONDS = 60 * 60 * 12
    }
}
