package com.atxfinance.backend.web

import com.google.cloud.pubsub.v1.SubscriptionAdminClient
import com.mongodb.client.MongoClient
import org.bson.Document
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class HealthController(
    private val mongoClient: MongoClient,
) {
    @GetMapping("/api/health")
    fun health(): ResponseEntity<Map<String, Any>> {
        val details = mutableMapOf<String, Any>()

        // Mongo check
        details["mongo"] = try {
            mongoClient.listDatabaseNames().first() // simple ping
            "ok"
        } catch (e: Exception) {
            mapOf("status" to "error", "message" to (e.message ?: "mongo error"))
        }

        // Secrets check (presence only; do not leak values) — align with Docker Compose + Atlas (B64) flows
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
}