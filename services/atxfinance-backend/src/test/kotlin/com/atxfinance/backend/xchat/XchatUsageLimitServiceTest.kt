package com.atxfinance.backend.xchat

import com.atxfinance.backend.config.AtxfinanceProperties
import de.flapdoodle.embed.mongo.MongodExecutable
import de.flapdoodle.embed.mongo.MongodStarter
import de.flapdoodle.embed.mongo.config.MongodConfig
import de.flapdoodle.embed.mongo.config.Net
import de.flapdoodle.embed.mongo.distribution.Version
import de.flapdoodle.embed.process.runtime.Network
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory

class XchatUsageLimitServiceTest {
    companion object {
        private val mongoPort: Int
        private val mongodExecutable: MongodExecutable
        private val mongoTemplate: MongoTemplate

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
            mongoTemplate =
                MongoTemplate(SimpleMongoClientDatabaseFactory("mongodb://127.0.0.1:$mongoPort/xchat-usage-test"))
            Runtime.getRuntime().addShutdownHook(
                Thread {
                    runCatching { mongodExecutable.stop() }
                },
            )
        }
    }

    @Test
    fun `minute cap blocks after threshold`() {
        val service = XchatUsageLimitService(mongoTemplate, AtxfinanceProperties())
        val input =
            XchatUsageLimitInput(
                userId = "user-minute-cap",
                tenantId = "tenant-a",
                subscriptionPlan = "basic",
                perMinuteLimit = 2,
                enforceDailyLimit = false,
                dailyPromptLimit = 5,
                hourlyPromptLimit = null,
            )
        assertTrue(service.enforceDistributedAskUsageLimit(input).allowed)
        assertTrue(service.enforceDistributedAskUsageLimit(input).allowed)
        val blocked = service.enforceDistributedAskUsageLimit(input)
        assertFalse(blocked.allowed)
        assertEquals("xchat_rate_limit_exceeded", blocked.code)
    }
}
