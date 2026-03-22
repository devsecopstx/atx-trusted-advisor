package com.atxfinance.backend.web

import com.mongodb.client.MongoClient
import com.mongodb.client.MongoDatabase
import com.mongodb.client.MongoIterable
import org.bson.Document
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.mockito.Mockito.*
import org.springframework.http.HttpStatus
import org.springframework.mock.env.MockEnvironment

class BackendHealthControllerTest {

    private fun buildControllerWith(
        mongoOk: Boolean,
        uri: String = "mongodb://user:secret@localhost:27017/atxfintechdb?authSource=admin",
        activeProfiles: Array<String> = arrayOf("test")
    ): BackendHealthController {
        val env = MockEnvironment()
        env.setActiveProfiles(*activeProfiles)
        env.withProperty("spring.application.name", "atxfinance-backend")
        env.withProperty("spring.data.mongodb.uri", uri)

        val mongoClient = mock(MongoClient::class.java)
        val db = mock(MongoDatabase::class.java)
        `when`(mongoClient.getDatabase("atxfintechdb")).thenReturn(db)
        if (mongoOk) {
            `when`(db.runCommand(Document("ping", 1))).thenReturn(Document("ok", 1))
        } else {
            `when`(db.runCommand(Document("ping", 1))).thenThrow(RuntimeException("ping failed"))
        }

        return BackendHealthController(env, mongoClient)
    }

    @Test
    fun `backendHealth returns ok and masks mongo credentials when mongo is reachable`() {
        val controller = buildControllerWith(mongoOk = true)
        val response = controller.backendHealth()

        assertEquals(HttpStatus.OK, response.statusCode)
        val body = response.body!!

        assertEquals("ok", body["status"]) // top-level status
        assertEquals("atxfinance-backend", body["service"]) // application name

        @Suppress("UNCHECKED_CAST")
        val details = body["details"] as Map<String, Any?>
        @Suppress("UNCHECKED_CAST")
        val mongo = details["mongo"] as Map<String, Any?>

        assertEquals("ok", mongo["status"]) // connectivity
        val masked = mongo["uriMasked"] as String
        // Should mask both username and password
        assertTrue(masked.contains(":***@"), "Expected masked credentials in URI, got: $masked")
        assertFalse(masked.contains("user:secret@"), "Masked URI must not contain raw credentials")

        // Host and database extracted
        assertEquals("localhost:27017", mongo["host"])
        assertEquals("atxfintechdb", mongo["database"]) 
    }

    @Test
    @Suppress("UNCHECKED_CAST")
    fun `apiHealthCompat returns ok when mongo lists databases`() {
        val env = MockEnvironment()
        env.setActiveProfiles("test")
        env.withProperty("spring.application.name", "atxfinance-backend")
        env.withProperty("spring.data.mongodb.uri", "mongodb://localhost:27017/atxfintechdb")

        val mongoClient = mock(MongoClient::class.java)
        val names = mock(MongoIterable::class.java) as MongoIterable<String>
        `when`(mongoClient.listDatabaseNames()).thenReturn(names)
        `when`(names.first()).thenReturn("admin")

        val controller = BackendHealthController(env, mongoClient)
        val response = controller.apiHealthCompat()

        assertEquals(HttpStatus.OK, response.statusCode)
        val body = response.body!!
        assertEquals("ok", body["status"])
        assertEquals("atxfinance-backend", body["service"])
        @Suppress("UNCHECKED_CAST")
        val details = body["details"] as Map<String, Any>
        assertEquals("ok", details["mongo"])
        // secrets uses System.getenv (not Spring env); CI/unit JVM often has none → missing map is valid
        val sec = details["secrets"]
        assertTrue(sec == "ok" || sec is Map<*, *>)
    }

    @Test
    fun `backendHealth reports error when mongo ping fails`() {
        val controller = buildControllerWith(mongoOk = false)
        val response = controller.backendHealth()

        assertEquals(HttpStatus.OK, response.statusCode) // endpoint still 200 with nested error details
        val body = response.body!!
        @Suppress("UNCHECKED_CAST")
        val details = body["details"] as Map<String, Any?>
        @Suppress("UNCHECKED_CAST")
        val mongo = details["mongo"] as Map<String, Any?>

        assertEquals("error", mongo["status"]) 
        assertNotNull(mongo["error"]) // contains error message
    }
}
