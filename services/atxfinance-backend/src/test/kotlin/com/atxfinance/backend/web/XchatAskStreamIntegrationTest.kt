package com.atxfinance.backend.web

import com.atxfinance.backend.session.SessionCookieParser
import de.flapdoodle.embed.mongo.MongodExecutable
import de.flapdoodle.embed.mongo.MongodStarter
import de.flapdoodle.embed.mongo.config.MongodConfig
import de.flapdoodle.embed.mongo.config.Net
import de.flapdoodle.embed.mongo.distribution.Version
import de.flapdoodle.embed.process.runtime.Network
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.client.TestRestTemplate
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import java.nio.charset.StandardCharsets
import java.util.Base64

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class XchatAskStreamIntegrationTest {
    @Autowired
    private lateinit var restTemplate: TestRestTemplate

    companion object {
        private const val AUTH_SECRET = "01234567890123456789012345678901"
        private const val USER_ID = "64a1b2c3d4e5f67890123456"
        private const val TENANT_ID = "64a1b2c3d4e5f67890123457"

        private val mongoPort: Int
        private val mongodExecutable: MongodExecutable

        init {
            val starter = MongodStarter.getDefaultInstance()
            val port = Network.getFreeServerPort()
            mongoPort = port
            val config =
                MongodConfig.builder()
                    .version(Version.Main.V6_0)
                    .net(Net("127.0.0.1", port, Network.localhostIsIPv6()))
                    .build()
            mongodExecutable = starter.prepare(config)
            mongodExecutable.start()
            Runtime.getRuntime().addShutdownHook(
                Thread {
                    runCatching { mongodExecutable.stop() }
                },
            )
        }

        @JvmStatic
        @DynamicPropertySource
        fun mongoProps(registry: DynamicPropertyRegistry) {
            registry.add("spring.data.mongodb.uri") { "mongodb://127.0.0.1:$mongoPort/atxfintechdb" }
            registry.add("AUTH_SECRET") { AUTH_SECRET }
        }

        private fun sessionCookieHeader(): String {
            val exp = System.currentTimeMillis() + 3_600_000L
            val payloadJson =
                """{"userId":"$USER_ID","tenantId":"$TENANT_ID","email":"a@b.c","roles":["advisor"],"exp":$exp}"""
            val enc =
                Base64.getUrlEncoder().withoutPadding().encodeToString(
                    payloadJson.toByteArray(StandardCharsets.UTF_8),
                )
            val sig = SessionCookieParser.sign(enc, AUTH_SECRET)
            return "xf_core_session=$enc.$sig"
        }
    }

    @Test
    fun `ask stream requires session cookie`() {
        val headers = HttpHeaders()
        headers.contentType = MediaType.APPLICATION_JSON
        val entity = HttpEntity("""{"message":"scan my options"}""", headers)
        val response =
            restTemplate.exchange("/api/xchat/ask/stream", HttpMethod.POST, entity, String::class.java)
        assertEquals(HttpStatus.UNAUTHORIZED, response.statusCode)
    }

    @Test
    fun `ask stream emits sse events for options scan intent`() {
        val headers =
            HttpHeaders().apply {
                add(HttpHeaders.COOKIE, sessionCookieHeader())
                accept = listOf(MediaType.TEXT_EVENT_STREAM)
                contentType = MediaType.APPLICATION_JSON
            }
        val entity =
            HttpEntity(
                """{"message":"Scan my options from holdings + watchlist","threadId":"thread-test-1"}""",
                headers,
            )
        val response =
            restTemplate.exchange("/api/xchat/ask/stream", HttpMethod.POST, entity, String::class.java)
        assertEquals(HttpStatus.OK, response.statusCode)
        val body = response.body.orEmpty()
        assertTrue(body.contains("event:meta") || body.contains("event: meta"), "body=$body")
        assertTrue(body.contains("event:tool_status") || body.contains("event: tool_status"), "body=$body")
        assertTrue(body.contains("event:delta") || body.contains("event: delta"), "body=$body")
        assertTrue(body.contains("event:done") || body.contains("event: done"), "body=$body")
        assertTrue(body.contains("options_action_scan"), "body=$body")
    }
}
