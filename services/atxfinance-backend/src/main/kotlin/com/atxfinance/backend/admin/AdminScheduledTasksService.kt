package com.atxfinance.backend.admin

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.util.Date
import kotlin.random.Random

@Service
class AdminScheduledTasksService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val userHistoryAgentService: UserHistoryAgentService,
) {

    fun listTasks(session: ResolvedSession, limit: Int): List<Map<String, Any?>> {
        val lim = limit.coerceIn(1, 500)
        val base = Criteria()
        val q = Query.query(PortfolioMongoFilter.withTenantScopeCriteria(base, session.tenantId.takeIf { it.isNotBlank() }))
            .with(Sort.by(Sort.Direction.ASC, "name"))
            .limit(lim)
        return mongoTemplate.find(q, Document::class.java, props.scheduledTasksCollection)
            .map { serializeScheduledTask(it) }
    }

    fun createTask(session: ResolvedSession, body: Map<String, Any?>): Map<String, Any?> {
        val name = (body["name"] as? String)?.trim().orEmpty()
        if (name.isEmpty()) {
            throw BadTaskPayloadException("name is required")
        }
        val category = (body["category"] as? String)?.trim()?.lowercase().orEmpty()
        if (category !in ALLOWED_CATEGORIES) {
            throw BadTaskPayloadException("Invalid category")
        }
        val scheduleCron = (body["scheduleCron"] as? String)?.trim().orEmpty()
        if (scheduleCron.length < 5) {
            throw BadTaskPayloadException("scheduleCron is invalid")
        }
        val enabled = body["enabled"] as? Boolean ?: true
        val now = Date()
        val nextRunAt = parseOptionalDate(body["nextRunAt"]) ?: Date(now.time + FIVE_MIN_MS)
        val doc = Document()
        doc["name"] = name
        doc["category"] = category
        doc["scheduleCron"] = scheduleCron
        doc["enabled"] = enabled
        doc["nextRunAt"] = nextRunAt
        PortfolioMongoFilter.tenantObjectId(session.tenantId)?.let { doc["tenantId"] = it }
        parseOptionalDate(body["lastRunAt"])?.let { doc["lastRunAt"] = it }
        val inserted = mongoTemplate.insert(doc, props.scheduledTasksCollection)
        return mapOf("data" to serializeScheduledTask(inserted))
    }

    fun getTaskForTenant(taskId: String, session: ResolvedSession): Document? {
        if (!ObjectId.isValid(taskId)) {
            return null
        }
        val oid = ObjectId(taskId)
        val base = Criteria.where("_id").`is`(oid)
        val q = Query.query(PortfolioMongoFilter.withTenantScopeCriteria(base, session.tenantId.takeIf { it.isNotBlank() }))
        return mongoTemplate.findOne(q, Document::class.java, props.scheduledTasksCollection)
    }

    fun listTaskRuns(session: ResolvedSession, limit: Int): List<Map<String, Any?>> {
        val lim = limit.coerceIn(1, 500)
        val base = Criteria()
        val q = Query.query(PortfolioMongoFilter.withTenantScopeCriteria(base, session.tenantId.takeIf { it.isNotBlank() }))
            .with(Sort.by(Sort.Direction.DESC, "startedAt"))
            .limit(lim)
        return mongoTemplate.find(q, Document::class.java, props.taskRunsCollection)
            .map { serializeTaskRun(it) }
    }

    data class ExecutionResult(
        val runIdHex: String,
        val status: String,
        val output: String,
    )

    fun executeScheduledTask(task: Document, triggeredBy: String): ExecutionResult {
        val taskId = task.getObjectId("_id") ?: throw IllegalStateException("task missing _id")
        val tenantOid = task.getObjectId("tenantId")
        val taskName = task.getString("name") ?: "task"
        val category = task.getString("category") ?: "sync-broker"

        val runDoc = Document()
        runDoc["taskId"] = taskId
        runDoc["taskName"] = taskName
        runDoc["category"] = category
        runDoc["triggeredBy"] = triggeredBy
        runDoc["output"] = "Task accepted and started"
        runDoc["status"] = "running"
        runDoc["startedAt"] = Date()
        tenantOid?.let { runDoc["tenantId"] = it }

        val inserted = mongoTemplate.insert(runDoc, props.taskRunsCollection)
        val runId = inserted.getObjectId("_id") ?: throw IllegalStateException("run missing _id")
        val startedAt = inserted.getDate("startedAt") ?: Date()

        markTaskRunWindow(taskId, startedAt)

        val (execStatus, execOutput) = when (category) {
            "user-history" -> userHistoryAgentService.run(tenantOid?.toHexString())
            else -> simulateTaskExecution(taskName, category)
        }
        val completedAt = Date()
        val durationMs = maxOf(1L, completedAt.time - startedAt.time)

        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(runId)),
            Update().apply {
                set("status", execStatus)
                set("output", execOutput)
                set("durationMs", durationMs)
                set("completedAt", completedAt)
            },
            props.taskRunsCollection,
        )

        return ExecutionResult(
            runIdHex = runId.toHexString(),
            status = execStatus,
            output = execOutput,
        )
    }

    fun listDueTasks(now: Date, session: ResolvedSession): List<Document> {
        val base = Criteria.where("enabled").`is`(true).and("nextRunAt").lte(now)
        val q = Query.query(PortfolioMongoFilter.withTenantScopeCriteria(base, session.tenantId.takeIf { it.isNotBlank() }))
            .with(Sort.by(Sort.Direction.ASC, "nextRunAt"))
            .limit(30)
        return mongoTemplate.find(q, Document::class.java, props.scheduledTasksCollection)
    }

    class BadTaskPayloadException(message: String) : RuntimeException(message)

    private fun markTaskRunWindow(taskId: ObjectId, startedAt: Date) {
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(taskId)),
            Update().apply {
                set("lastRunAt", startedAt)
                set("nextRunAt", Date(startedAt.time + ONE_DAY_MS))
            },
            props.scheduledTasksCollection,
        )
    }

    private fun simulateTaskExecution(taskName: String, category: String): Pair<String, String> {
        val waitMs = 120 + Random.nextInt(220)
        Thread.sleep(waitMs.toLong())
        val status: String
        val output: String
        when (category) {
            "sync-broker" -> {
                status = "success"
                output = "Broker sync completed for task \"$taskName\"."
            }
            "rebalance" -> {
                status = "success"
                output = "Rebalance analysis completed for task \"$taskName\"."
            }
            "compliance" -> {
                status = "success"
                output = "Compliance scan completed for task \"$taskName\"."
            }
            "notifications" -> {
                status = "success"
                output = "Notification digest dispatched for task \"$taskName\"."
            }
            else -> {
                status = "failed"
                output = "Unsupported task category for \"$taskName\"."
            }
        }
        return status to output
    }

    private fun serializeScheduledTask(doc: Document): Map<String, Any?> {
        val m = mutableMapOf<String, Any?>()
        doc.getObjectId("_id")?.let { m["_id"] = it.toHexString() }
        doc.getObjectId("tenantId")?.let { m["tenantId"] = it.toHexString() }
        m["name"] = doc.getString("name")
        m["category"] = doc.getString("category")
        m["scheduleCron"] = doc.getString("scheduleCron")
        m["enabled"] = doc.getBoolean("enabled")
        doc.getDate("lastRunAt")?.let { m["lastRunAt"] = it.toInstant().toString() }
        doc.getDate("nextRunAt")?.let { m["nextRunAt"] = it.toInstant().toString() }
        return m
    }

    private fun serializeTaskRun(doc: Document): Map<String, Any?> {
        val m = mutableMapOf<String, Any?>()
        doc.getObjectId("_id")?.let { m["_id"] = it.toHexString() }
        doc.getObjectId("tenantId")?.let { m["tenantId"] = it.toHexString() }
        doc.getObjectId("taskId")?.let { m["taskId"] = it.toHexString() }
        m["taskName"] = doc.getString("taskName")
        m["category"] = doc.getString("category")
        m["triggeredBy"] = doc.getString("triggeredBy")
        m["status"] = doc.getString("status")
        doc.getDate("startedAt")?.let { m["startedAt"] = it.toInstant().toString() }
        doc.getDate("completedAt")?.let { m["completedAt"] = it.toInstant().toString() }
        (doc["durationMs"] as? Number)?.toLong()?.let { m["durationMs"] = it }
        m["output"] = doc.getString("output")
        return m
    }

    private fun parseOptionalDate(value: Any?): Date? = when (value) {
        null -> null
        is Date -> value
        is String -> try {
            Date.from(java.time.Instant.parse(value))
        } catch (_: Exception) {
            null
        }
        else -> null
    }

    companion object {
        private val ALLOWED_CATEGORIES =
            setOf("sync-broker", "rebalance", "compliance", "notifications", "user-history")
        private const val FIVE_MIN_MS = 5L * 60L * 1000L
        private const val ONE_DAY_MS = 24L * 60L * 60L * 1000L
    }
}
