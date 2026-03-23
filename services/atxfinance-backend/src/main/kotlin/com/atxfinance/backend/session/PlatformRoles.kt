package com.atxfinance.backend.session

private const val GLOBAL_ADMIN = "global_admin"
private const val LEGACY_ADMIN = "admin"

/** Mirrors `normalizeCoreRole` + `isGlobalAdmin` in `src/modules/identity/authorization.ts`. */
fun ResolvedSession.isGlobalAdmin(): Boolean =
    roles.any { role ->
        val r = role.trim().lowercase()
        r == GLOBAL_ADMIN || r == LEGACY_ADMIN
    }

private val LOGIN_ALLOWED = setOf("global_admin", "advisor", "operator", "viewer")

/** Mirrors `canUserLogin` in `src/modules/identity/authorization.ts`. */
fun ResolvedSession.canUserLogin(): Boolean =
    roles.any { role ->
        val r = role.trim().lowercase()
        val n = if (r == LEGACY_ADMIN) GLOBAL_ADMIN else r
        n in LOGIN_ALLOWED
    }
