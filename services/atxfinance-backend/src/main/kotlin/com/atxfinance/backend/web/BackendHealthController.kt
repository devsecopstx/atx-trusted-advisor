package com.atxfinance.backend.web

import com.mongodb.client.MongoClient
import org.bson.Document
import org.springframework.core.env.Environment
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import java.net.URI
import java.time.OffsetDateTime
import java.time.ZoneOffset

@RestController
class BackendHealthController(
    private val env: Environment,
    private val mongoClient: MongoClient,
) {

    /** Compatibility shim for load balancers / parity with core app health shape (see docs/ops/atxfinance-backend-http-api.md). */
    @GetMapping("/api/health")
    fun apiHealthCompat(): ResponseEntity<Map<String, Any>> {
        val details = mutableMapOf<String, Any>()
        details["mongo"] = try {
            mongoClient.listDatabaseNames().first()
            "ok"
        } catch (e: Exception) {
            mapOf("status" to "error", "message" to (e.message ?: "mongo error"))
        }
        val secretsOk = listOf(
            System.getenv("MONGODB_URI"),
            System.getenv("SPRING_DATA_MONGODB_URI"),
            System.getenv("MONGODB_URI_B64")
        ).any { !it.isNullOrBlank() }
        details["secrets"] = if (secretsOk) {
            "ok"
        } else {
            mapOf(
                "status" to "missing",
                "keys" to listOf("MONGODB_URI", "SPRING_DATA_MONGODB_URI", "MONGODB_URI_B64")
            )
        }
        val body = mapOf(
            "status" to "ok",
            "service" to "atxfinance-backend",
            "details" to details
        )
        return ResponseEntity.ok(body)
    }

    @GetMapping("/api/backend/health")
    fun backendHealth(): ResponseEntity<Map<String, Any?>> {
        val now = OffsetDateTime.now(ZoneOffset.UTC).toString()
        val profiles = env.activeProfiles.toList()

        // Resolve effective Mongo URI from Spring properties
        val effectiveUri = env.getProperty("spring.data.mongodb.uri")
            ?: "mongodb://localhost:27017/${'$'}{SPRING_DATA_MONGODB_DATABASE:${'$'}{MONGODB_DB_NAME:atxfintechdb}}" // mirror default for transparency only

        val source = determineMongoUriSource(effectiveUri)
        val masked = maskMongoUri(effectiveUri)
        val hostAndDb = extractHostAndDb(effectiveUri)

        val mongoDetails = mutableMapOf<String, Any?>(
            "status" to "unknown",
            "source" to source,
            "uriMasked" to masked,
            "host" to hostAndDb.first,
            "database" to hostAndDb.second
        )

        // Lightweight connectivity check
        try {
            val dbName = hostAndDb.second ?: "admin"
            mongoClient.getDatabase(dbName).runCommand(Document("ping", 1))
            mongoDetails["status"] = "ok"
        } catch (e: Exception) {
            mongoDetails["status"] = "error"
            mongoDetails["error"] = (e.message ?: "mongo error")
        }

        val body = mapOf(
            "status" to "ok",
            "service" to (env.getProperty("spring.application.name") ?: "atxfinance-backend"),
            "time" to now,
            "activeProfiles" to profiles,
            "details" to mapOf(
                "mongo" to mongoDetails,
                "env" to mapOf(
                    "MONGODB_URI_B64_present" to !System.getenv("MONGODB_URI_B64").isNullOrBlank(),
                    "SPRING_DATA_MONGODB_URI_present" to !System.getenv("SPRING_DATA_MONGODB_URI").isNullOrBlank(),
                    "MONGODB_URI_present" to !System.getenv("MONGODB_URI").isNullOrBlank(),
                    "DEFAULT_TENANT_SLUG" to (System.getenv("DEFAULT_TENANT_SLUG") ?: ""),
                    "TENANT_PORTFOLIO_ORG_KEY" to (System.getenv("TENANT_PORTFOLIO_ORG_KEY") ?: "")
                )
            )
        )
        return ResponseEntity.ok(body)
    }

    private fun determineMongoUriSource(effective: String): String {
        // Check precedence and match to effective value when possible
        val b64 = System.getenv("MONGODB_URI_B64")?.trim()?.takeIf { it.isNotEmpty() }
        if (!b64.isNullOrEmpty()) {
            try {
                val decoded = try {
                    String(java.util.Base64.getDecoder().decode(b64))
                } catch (e: IllegalArgumentException) {
                    String(java.util.Base64.getUrlDecoder().decode(b64))
                }
                if (decoded == effective) return "MONGODB_URI_B64"
            } catch (_: Exception) {
                // ignore
            }
        }
        val springEnv = System.getenv("SPRING_DATA_MONGODB_URI")?.trim()?.takeIf { it.isNotEmpty() }
        if (springEnv != null && springEnv == effective) return "SPRING_DATA_MONGODB_URI"
        val mongoEnv = System.getenv("MONGODB_URI")?.trim()?.takeIf { it.isNotEmpty() }
        if (mongoEnv != null && mongoEnv == effective) return "MONGODB_URI"
        return "default"
    }

    private fun maskMongoUri(uri: String?): String? {
        if (uri.isNullOrBlank()) return uri
        return try {
            val u = URI(uri)
            val userInfo = u.userInfo
            if (userInfo.isNullOrBlank()) return uri
            val at = uri.indexOf("@")
            val schemeSep = uri.indexOf("://")
            if (at > 0 && schemeSep > 0) {
                val prefix = uri.substring(0, schemeSep + 3)
                val rest = uri.substring(at + 1)
                val user = userInfo.substringBefore(":", userInfo)
                val maskedUser = if (user.isNotEmpty()) user.take(1) + "***" else "***"
                return prefix + maskedUser + ":***@" + rest
            }
            uri
        } catch (_: Exception) {
            // Fallback simple masking
            val at = uri.indexOf("@")
            val schemeSep = uri.indexOf("://")
            if (at > 0 && schemeSep > 0) {
                val prefix = uri.substring(0, schemeSep + 3)
                val rest = uri.substring(at + 1)
                return prefix + "***:***@" + rest
            }
            uri
        }
    }

    private fun extractHostAndDb(uri: String?): Pair<String?, String?> {
        if (uri.isNullOrBlank()) return Pair(null, null)
        return try {
            val withoutScheme = uri.replace(Regex("^mongodb(\\+srv)?://"), "")
            val afterAt = withoutScheme.substringAfter("@", withoutScheme)
            val hostAndPath = afterAt.substringBefore("?")
            val host = hostAndPath.substringBefore("/")
            val db = hostAndPath.substringAfter("/", "").takeIf { it.isNotEmpty() }
            Pair(host, db)
        } catch (_: Exception) {
            Pair(null, null)
        }
    }
}
