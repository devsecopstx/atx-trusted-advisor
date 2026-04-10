package com.atxfinance.backend.scheduling

import com.atxfinance.backend.admin.AdminScheduledTasksService
import de.flapdoodle.embed.mongo.MongodExecutable
import de.flapdoodle.embed.mongo.MongodStarter
import de.flapdoodle.embed.mongo.config.MongodConfig
import de.flapdoodle.embed.mongo.config.Net
import de.flapdoodle.embed.mongo.distribution.Version
import de.flapdoodle.embed.process.runtime.Network
import org.bson.Document
import org.bson.types.ObjectId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import java.util.Date

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AdminSchedulerSystemPollIntegrationTest {

    @Autowired
    private lateinit var adminScheduledTasksService: AdminScheduledTasksService

    @Autowired
    private lateinit var mongoTemplate: MongoTemplate

    companion object {
        private const val AUTH_SECRET = "01234567890123456789012345678901"
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
    }

    @Test
    fun `enqueueDueTasksForSystemPoll picks cross-tenant due task and sets system-scheduler trigger`() {
        val tenantOid = ObjectId(TENANT_ID)
        val task = Document()
        task["name"] = "system-poll-test-${System.nanoTime()}"
        task["category"] = "sync-broker"
        task["scheduleCron"] = "0 0 * * *"
        task["enabled"] = true
        task["nextRunAt"] = Date(System.currentTimeMillis() - 120_000L)
        task["tenantId"] = tenantOid
        val inserted = mongoTemplate.insert(task, "admin_scheduled_tasks")
        val taskId = inserted.getObjectId("_id")!!

        val accepted = adminScheduledTasksService.enqueueDueTasksForSystemPoll(Date())
        assertEquals(1, accepted.size)

        Thread.sleep(2_000L)

        val q =
            Query.query(
                Criteria().andOperator(
                    Criteria.where("taskId").`is`(taskId),
                    Criteria.where("triggeredBy").`is`(AdminScheduledTasksService.SYSTEM_SCHEDULER_TRIGGER),
                ),
            )
        val runs = mongoTemplate.find(q, Document::class.java, "admin_task_runs")
        assertEquals(1, runs.size)
        assertEquals("success", runs[0].getString("status"))

        val refreshed = mongoTemplate.findById(taskId, Document::class.java, "admin_scheduled_tasks")
        assertTrue(refreshed != null && refreshed.getDate("nextRunAt") != null)
        assertTrue(
            refreshed!!.getDate("nextRunAt")!!.time > task.getDate("nextRunAt")!!.time,
            "nextRunAt should advance after start",
        )

        val second = adminScheduledTasksService.enqueueDueTasksForSystemPoll(Date())
        assertEquals(0, second.size, "task no longer due — no duplicate enqueue")
    }
}
