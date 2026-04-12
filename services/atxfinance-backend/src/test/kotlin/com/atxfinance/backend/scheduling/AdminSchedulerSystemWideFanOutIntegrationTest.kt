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
class AdminSchedulerSystemWideFanOutIntegrationTest {

    @Autowired
    private lateinit var adminScheduledTasksService: AdminScheduledTasksService

    @Autowired
    private lateinit var mongoTemplate: MongoTemplate

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
    fun `system-wide task fans out to all tenants and advances schedule once`() {
        // Seed two tenants
        val t1 = mongoTemplate.insert(Document().apply { this["slug"] = "tenant-a" }, "core_tenants")
        val t2 = mongoTemplate.insert(Document().apply { this["slug"] = "tenant-b" }, "core_tenants")
        val tenants = listOf(t1.getObjectId("_id")!!, t2.getObjectId("_id")!!)

        // Insert a system-wide due task (no tenantId)
        val task = Document()
        task["name"] = "system-fanout-${System.nanoTime()}"
        task["category"] = "options_scanner"
        task["scheduleCron"] = "0 0 * * *"
        task["enabled"] = true
        task["nextRunAt"] = Date(System.currentTimeMillis() - 120_000L)
        val inserted = mongoTemplate.insert(task, "admin_scheduled_tasks")
        val taskId = inserted.getObjectId("_id")!!
        val prevNext = inserted.getDate("nextRunAt")

        // Enqueue via system poll (JVM fan-out)
        val accepted = adminScheduledTasksService.enqueueDueTasksForSystemPoll(Date())
        assertEquals(tenants.size, accepted.size, "Should enqueue one run per tenant")

        Thread.sleep(1_200L)

        // Verify runs were created per tenant and marked with system-scheduler trigger
        val runs = mongoTemplate.find(
            Query.query(
                Criteria().andOperator(
                    Criteria.where("taskId").`is`(taskId),
                    Criteria.where("triggeredBy").`is`(AdminScheduledTasksService.SYSTEM_SCHEDULER_TRIGGER),
                ),
            ),
            Document::class.java,
            "admin_task_runs",
        )
        assertEquals(tenants.size, runs.size)
        val runTenantIds: Set<ObjectId> = runs.mapNotNull { it.getObjectId("tenantId") }.toSet()
        assertEquals(tenants.toSet(), runTenantIds, "Runs should target each tenantId")

        // Ensure schedule advanced once (task nextRunAt later than before) and not due again immediately
        val refreshed = mongoTemplate.findById(taskId, Document::class.java, "admin_scheduled_tasks")
        assertTrue(refreshed != null && refreshed.getDate("nextRunAt") != null)
        assertTrue(refreshed!!.getDate("nextRunAt")!!.time > prevNext!!.time)

        val second = adminScheduledTasksService.enqueueDueTasksForSystemPoll(Date())
        assertEquals(0, second.size, "After advancing schedule, it should not re-enqueue immediately")
    }
}
