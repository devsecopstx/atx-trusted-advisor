package com.atxfinance.backend.config

import java.util.Base64

/**
 * Resolves [MONGODB_URI] values: plain `mongodb://` / `mongodb+srv://`, or base64-encoded (standard or URL-safe),
 * matching Node `src/lib/env.ts` / `scripts/lib/resolve-mongo-uri.mjs`.
 */
object MongoUriResolver {
    fun resolve(raw: String): String {
        val t = raw.trim()
        if (t.startsWith("mongodb://") || t.startsWith("mongodb+srv://")) {
            return t
        }
        val decoded = try {
            String(Base64.getDecoder().decode(t))
        } catch (_: IllegalArgumentException) {
            String(Base64.getUrlDecoder().decode(t))
        }.trim()
        if (!decoded.startsWith("mongodb://") && !decoded.startsWith("mongodb+srv://")) {
            throw IllegalArgumentException("MONGODB_URI is not a valid MongoDB URI or base64 thereof")
        }
        return decoded
    }
}
