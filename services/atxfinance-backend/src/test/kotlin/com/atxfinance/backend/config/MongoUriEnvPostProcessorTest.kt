package com.atxfinance.backend.config

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.boot.SpringApplication
import org.springframework.core.env.MapPropertySource
import org.springframework.core.env.StandardEnvironment

class MongoUriEnvPostProcessorTest {

    @Test
    fun `decodes standard base64 and sets spring mongo property`() {
        val encoded = java.util.Base64.getEncoder().encodeToString(
            "mongodb://user:pass@host:27017/db?authSource=admin".toByteArray()
        )
        val env = StandardEnvironment()
        env.propertySources.addFirst(MapPropertySource("test", mapOf("MONGODB_URI_B64" to encoded)))

        MongoUriEnvPostProcessor().postProcessEnvironment(env, SpringApplication())

        assertEquals(
            "mongodb://user:pass@host:27017/db?authSource=admin",
            env.getProperty("spring.data.mongodb.uri")
        )
        assertEquals(env.getProperty("SPRING_DATA_MONGODB_URI"), env.getProperty("spring.data.mongodb.uri"))
        assertEquals(env.getProperty("MONGODB_URI"), env.getProperty("spring.data.mongodb.uri"))
    }

    @Test
    fun `decodes url safe base64 when needed`() {
        val urlSafeEncoded = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
            "mongodb://user:pass@host:27017/db".toByteArray()
        )
        val env = StandardEnvironment()
        env.propertySources.addFirst(MapPropertySource("test", mapOf("MONGODB_URI_B64" to urlSafeEncoded)))

        MongoUriEnvPostProcessor().postProcessEnvironment(env, SpringApplication())

        assertEquals("mongodb://user:pass@host:27017/db", env.getProperty("spring.data.mongodb.uri"))
    }
}
