package com.atxfinance.backend.web

import com.atxfinance.backend.session.SessionCookieParser
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import de.flapdoodle.embed.mongo.MongodExecutable
import de.flapdoodle.embed.mongo.MongodStarter
import de.flapdoodle.embed.mongo.config.MongodConfig
import de.flapdoodle.embed.mongo.config.Net
import de.flapdoodle.embed.mongo.distribution.Version
import de.flapdoodle.embed.process.runtime.Network
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
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

/**
 * End-to-end HTTP CRUD against the Spring surface documented in [docs/ops/atxfinance-backend-http-api.md].
 * Uses embedded MongoDB (no Docker). Covers health, portfolios, accounts, watchlist, positions.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BackendHttpApiCrudIntegrationTest {

    @Autowired
    private lateinit var restTemplate: TestRestTemplate

    @Autowired
    private lateinit var objectMapper: ObjectMapper

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
                """{"userId":"$USER_ID","tenantId":"$TENANT_ID","email":"a@b.c","exp":$exp}"""
            val enc =
                Base64.getUrlEncoder().withoutPadding().encodeToString(
                    payloadJson.toByteArray(StandardCharsets.UTF_8),
                )
            val sig = SessionCookieParser.sign(enc, AUTH_SECRET)
            return "xf_core_session=$enc.$sig"
        }
    }

    private fun cookieHeaders(): HttpHeaders =
        HttpHeaders().apply {
            add(HttpHeaders.COOKIE, sessionCookieHeader())
        }

    private fun json(path: String, method: HttpMethod, body: String?, headers: HttpHeaders): JsonNode {
        val entity = HttpEntity(body, headers)
        val response =
            restTemplate.exchange(path, method, entity, String::class.java)
        assertTrue(
            response.statusCode.is2xxSuccessful,
            "Expected 2xx for $method $path got ${response.statusCode} body=${response.body}",
        )
        return objectMapper.readTree(response.body!!)
    }

    private fun jsonExpectStatus(
        path: String,
        method: HttpMethod,
        body: String?,
        headers: HttpHeaders,
        expected: HttpStatus,
    ): JsonNode {
        val entity = HttpEntity(body, headers)
        val response = restTemplate.exchange(path, method, entity, String::class.java)
        assertEquals(expected, response.statusCode, "body=${response.body}")
        return if (response.body.isNullOrBlank()) {
            objectMapper.createObjectNode()
        } else {
            objectMapper.readTree(response.body)
        }
    }

    @Test
    fun `health and full portfolio positions crud flow`() {
        val health = json("/api/health", HttpMethod.GET, null, HttpHeaders())
        assertEquals("ok", health.path("status").asText())

        val backendHealth = json("/api/backend/health", HttpMethod.GET, null, HttpHeaders())
        assertEquals("ok", backendHealth.path("status").asText())
        assertEquals("atxfinance-backend", backendHealth.path("service").asText())

        val ch = cookieHeaders()
        ch.contentType = MediaType.APPLICATION_JSON

        val defaultGet = json("/api/portfolios/default", HttpMethod.GET, null, ch)
        val portfolioId = defaultGet.path("data").path("_id").asText()
        assertTrue(portfolioId.isNotEmpty())

        val current = json("/api/portfolios/current", HttpMethod.GET, null, ch)
        assertEquals(portfolioId, current.path("data").path("_id").asText())

        val postDefault = json("/api/portfolios/default", HttpMethod.POST, null, ch)
        assertTrue(postDefault.path("synced").asBoolean())

        val single = json("/api/portfolios/$portfolioId", HttpMethod.GET, null, ch)
        assertEquals(portfolioId, single.path("data").path("_id").asText())

        val renamed = "CRUD Test Portfolio ${System.nanoTime()}"
        val patched =
            json(
                "/api/portfolios/$portfolioId",
                HttpMethod.PATCH,
                """{"name":"$renamed"}""",
                ch,
            )
        assertEquals(renamed, patched.path("data").path("name").asText())

        val accountsBefore = json("/api/portfolios/$portfolioId/accounts", HttpMethod.GET, null, ch)
        val accountsArr = accountsBefore.path("data")
        assertTrue(accountsArr.isArray)
        assertTrue(accountsArr.size() > 0)
        val defaultAccountId = accountsArr[0].path("_id").asText()

        val createdAccount =
            json(
                "/api/portfolios/$portfolioId/accounts",
                HttpMethod.POST,
                """{"name":"Extra Account","type":"schwab","extAccountId":"ext-crud-1","cashBalance":5000}""",
                ch,
            )
        val extraAccountId = createdAccount.path("data").path("_id").asText()
        assertTrue(extraAccountId.isNotEmpty())

        val patchedAccount =
            json(
                "/api/portfolios/$portfolioId/accounts/$extraAccountId",
                HttpMethod.PATCH,
                """{"name":"Extra Account Renamed","cashBalance":5100}""",
                ch,
            )
        assertEquals("Extra Account Renamed", patchedAccount.path("data").path("name").asText())

        val wl = json("/api/portfolios/$portfolioId/watchlist", HttpMethod.GET, null, ch)
        assertTrue(wl.path("data").path("symbols").isArray)

        val wlPatched =
            json(
                "/api/portfolios/$portfolioId/watchlist",
                HttpMethod.PATCH,
                """{"addSymbols":["NVDA"]}""",
                ch,
            )
        val symbols = wlPatched.path("data").path("symbols")
        assertTrue(symbols.toString().contains("NVDA"))

        val positionsEmpty =
            json(
                "/api/positions?portfolioId=$portfolioId&accountId=$defaultAccountId",
                HttpMethod.GET,
                null,
                ch,
            )
        assertTrue(positionsEmpty.path("data").isArray)

        val posCreated =
            json(
                "/api/positions",
                HttpMethod.POST,
                """{"portfolioId":"$portfolioId","accountId":"$defaultAccountId","symbol":"AAPL","qty":10,"avgCost":150.5}""",
                ch,
            )
        val positionId = posCreated.path("data").path("_id").asText()
        assertNotNull(positionId)
        assertFalse(positionId.isBlank())

        val positionsListed =
            json(
                "/api/positions?portfolioId=$portfolioId&accountId=$defaultAccountId",
                HttpMethod.GET,
                null,
                ch,
            )
        assertTrue(positionsListed.path("data").size() >= 1)

        json(
            "/api/positions/$positionId?portfolioId=$portfolioId&accountId=$defaultAccountId",
            HttpMethod.DELETE,
            null,
            ch,
        )

        val afterDelete =
            json(
                "/api/positions?portfolioId=$portfolioId&accountId=$defaultAccountId",
                HttpMethod.GET,
                null,
                ch,
            )
        val ids =
            afterDelete.path("data").map { it.path("_id").asText() }.filter { it.isNotBlank() }
        assertFalse(ids.contains(positionId))
    }

    @Test
    fun `unauthorized without session cookie on protected routes`() {
        val headers = HttpHeaders()
        val r =
            restTemplate.exchange(
                "/api/portfolios/default",
                HttpMethod.GET,
                HttpEntity<Void>(headers),
                String::class.java,
            )
        assertEquals(HttpStatus.UNAUTHORIZED, r.statusCode)
    }

    @Test
    fun `invalid portfolio id returns 400`() {
        val r =
            jsonExpectStatus(
                "/api/portfolios/not-a-valid-objectid",
                HttpMethod.GET,
                null,
                cookieHeaders(),
                HttpStatus.BAD_REQUEST,
            )
        assertEquals("Invalid portfolio id", r.path("error").asText())
    }

    @Test
    fun `positions list requires query params`() {
        val r =
            jsonExpectStatus(
                "/api/positions",
                HttpMethod.GET,
                null,
                cookieHeaders(),
                HttpStatus.BAD_REQUEST,
            )
        assertTrue(r.path("error").asText().contains("portfolioId"))
    }
}
