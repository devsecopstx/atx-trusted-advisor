package com.atxfinance.backend.config

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.boot.SpringApplication
import org.springframework.core.env.MapPropertySource
import org.springframework.core.env.StandardEnvironment

class MongoUriEnvPostProcessorTest {

    private fun assertUriContainsDefaultMongoOptions(uri: String) {
        assertTrue(uri.contains("connectTimeoutMS=15000"), "missing connect timeout")
        assertTrue(uri.contains("socketTimeoutMS=120000"), "missing socket timeout")
        assertTrue(uri.contains("serverSelectionTimeoutMS=20000"), "missing server selection timeout")
        assertTrue(uri.contains("waitQueueTimeoutMS=15000"), "missing wait queue timeout")
        assertTrue(uri.contains("maxIdleTimeMS=120000"), "missing max idle timeout")
        assertTrue(uri.contains("retryReads=true"), "missing retryReads")
        assertTrue(uri.contains("retryWrites=true"), "missing retryWrites")
    }

    @Test
    fun `decodes standard base64 and sets spring mongo property`() {
        val encoded = java.util.Base64.getEncoder().encodeToString(
            "mongodb://user:pass@host:27017/db?authSource=admin".toByteArray()
        )
        val env = StandardEnvironment()
        env.propertySources.addFirst(MapPropertySource("test", mapOf("MONGODB_URI" to encoded)))

        MongoUriEnvPostProcessor().postProcessEnvironment(env, SpringApplication())

        val uri = env.getProperty("spring.data.mongodb.uri")
        assertNotNull(uri)
        assertTrue(uri!!.startsWith("mongodb://user:pass@host:27017/db?authSource=admin"))
        assertUriContainsDefaultMongoOptions(uri)
        assertEquals(env.getProperty("SPRING_DATA_MONGODB_URI"), env.getProperty("spring.data.mongodb.uri"))
        assertEquals(env.getProperty("MONGODB_URI"), env.getProperty("spring.data.mongodb.uri"))
    }

    @Test
    fun `decodes url safe base64 when needed`() {
        val urlSafeEncoded = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
            "mongodb://user:pass@host:27017/db".toByteArray()
        )
        val env = StandardEnvironment()
        env.propertySources.addFirst(MapPropertySource("test", mapOf("MONGODB_URI" to urlSafeEncoded)))

        MongoUriEnvPostProcessor().postProcessEnvironment(env, SpringApplication())

        val uri = env.getProperty("spring.data.mongodb.uri")
        assertNotNull(uri)
        assertTrue(uri!!.startsWith("mongodb://user:pass@host:27017/db?"))
        assertUriContainsDefaultMongoOptions(uri)
    }

    @Test
    fun `uses plain mongodb URI without decoding`() {
        val plain = "mongodb://user:pass@host:27017/db"
        val env = StandardEnvironment()
        env.propertySources.addFirst(MapPropertySource("test", mapOf("MONGODB_URI" to plain)))

        MongoUriEnvPostProcessor().postProcessEnvironment(env, SpringApplication())

        val uri = env.getProperty("spring.data.mongodb.uri")
        assertNotNull(uri)
        assertTrue(uri!!.startsWith("$plain?"))
        assertUriContainsDefaultMongoOptions(uri)
    }

    @Test
    fun `legacy MONGODB_URI_B64 property still resolves`() {
        val encoded = java.util.Base64.getEncoder().encodeToString(
            "mongodb://legacy:pass@host:27017/legacydb".toByteArray()
        )
        val env = StandardEnvironment()
        env.propertySources.addFirst(MapPropertySource("test", mapOf("MONGODB_URI_B64" to encoded)))

        MongoUriEnvPostProcessor().postProcessEnvironment(env, SpringApplication())

        val uri = env.getProperty("spring.data.mongodb.uri")
        assertNotNull(uri)
        assertTrue(uri!!.startsWith("mongodb://legacy:pass@host:27017/legacydb?"))
        assertUriContainsDefaultMongoOptions(uri)
    }

    @Test
    fun `keeps explicit URI timeout and retry options`() {
        val explicitUri =
            "mongodb://user:pass@host:27017/db?socketTimeoutMS=45000&connectTimeoutMS=3000&retryReads=false"
        val env = StandardEnvironment()
        env.propertySources.addFirst(MapPropertySource("test", mapOf("MONGODB_URI" to explicitUri)))

        MongoUriEnvPostProcessor().postProcessEnvironment(env, SpringApplication())

        val uri = env.getProperty("spring.data.mongodb.uri")
        assertNotNull(uri)
        assertTrue(uri!!.contains("socketTimeoutMS=45000"))
        assertTrue(uri.contains("connectTimeoutMS=3000"))
        assertTrue(uri.contains("retryReads=false"))
        assertTrue(uri.contains("retryWrites=true"))
        assertTrue(uri.contains("serverSelectionTimeoutMS=20000"))
    }

    @Test
    fun `env overrides default mongo timeout options`() {
        val env = StandardEnvironment()
        env.propertySources.addFirst(
            MapPropertySource(
                "test",
                mapOf(
                    "MONGODB_URI" to "mongodb://user:pass@host:27017/db",
                    "MONGODB_SOCKET_TIMEOUT_MS" to "300000",
                    "MONGODB_SERVER_SELECTION_TIMEOUT_MS" to "45000",
                    "MONGODB_RETRY_READS" to "false",
                )
            )
        )

        MongoUriEnvPostProcessor().postProcessEnvironment(env, SpringApplication())

        val uri = env.getProperty("spring.data.mongodb.uri")
        assertNotNull(uri)
        assertTrue(uri!!.contains("socketTimeoutMS=300000"))
        assertTrue(uri.contains("serverSelectionTimeoutMS=45000"))
        assertTrue(uri.contains("retryReads=false"))
    }
}
