package com.atxfinance.backend

import de.flapdoodle.embed.mongo.MongodExecutable
import de.flapdoodle.embed.mongo.MongodStarter
import de.flapdoodle.embed.mongo.config.MongodConfig
import de.flapdoodle.embed.mongo.config.Net
import de.flapdoodle.embed.mongo.distribution.Version
import de.flapdoodle.embed.process.runtime.Network
import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource

/**
 * Ensures the Spring context starts. Uses embedded Mongo (same pattern as other `@SpringBootTest`s)
 * so CI/agents do not depend on a host Mongo on `localhost:27017`.
 */
@SpringBootTest
class ContextLoadsTest {
    companion object {
        private const val AUTH_SECRET = "01234567890123456789012345678901"

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
    }

    @Test
    fun contextLoads() {
        // If the application context fails to start, this test will fail.
    }
}
