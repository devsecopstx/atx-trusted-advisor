package com.atxfinance.backend.admin

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.strategy.OptionsStrategyEngine
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import org.springframework.scheduling.support.CronExpression
import net.javacrumbs.shedlock.core.LockConfiguration
import java.time.ZoneId
import java.time.Instant
import java.time.Duration
import java.util.Date
import kotlin.random.Random

@Service
class AdminScheduledTasksService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val userHistoryAgentService: UserHistoryAgentService,
    private val optionsStrategyEngine: OptionsStrategyEngine,
    private val nextSchedulerExecuteClient: NextSchedulerExecuteClient,
    private val lockProvider: net.javacrumbs.shedlock.core.LockProvider,
    @org.springframework.beans.factory.annotation.Qualifier("schedulerTaskExecutor")
    private val taskExecutor: org.springframework.core.task.TaskExecutor,
) {

    fun listTasks(session: ResolvedSession, limit: Int): List<Map<String, Any?>> {
        val lim = limit.coerceIn(1, 500)
        val tenantLevelOnly = Criteria().orOperator(
            Criteria.where("portfolioId").exists(false),
            Criteria.where("portfolioId").`is`(null),
        )
        val q = Query.query(
            PortfolioMongoFilter.scheduledTaskTenantReadCriteria(
                tenantLevelOnly,
                session.tenantId.takeIf { it.isNotBlank() },
            ),
        )
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
        if (!isValidCron(scheduleCron)) {
            throw BadTaskPayloadException("scheduleCron is invalid")
        }
        val enabled = body["enabled"] as? Boolean ?: true
        val now = Date()
        val explicitNext = parseOptionalDate(body["nextRunAt"])?.takeIf { enabled }
        val nextRunAt = explicitNext ?: computeNextRunAt(scheduleCron, now)
            ?: throw BadTaskPayloadException("scheduleCron could not compute next run")
        val doc = Document()
        doc["name"] = name
        doc["category"] = category
        doc["scheduleCron"] = scheduleCron
        doc["enabled"] = enabled
        doc["nextRunAt"] = nextRunAt
        PortfolioMongoFilter.tenantObjectId(session.tenantId)?.let { doc["tenantId"] = it }
        parseOptionalDate(body["lastRunAt"])?.let { doc["lastRunAt"] = it }
        val dctRaw = body["deliveryChannelTarget"] as? String
        if (!dctRaw.isNullOrBlank()) {
            doc["deliveryChannelTarget"] = assertDeliveryChannelExists(session, dctRaw.trim())
        }
        val inserted = mongoTemplate.insert(doc, props.scheduledTasksCollection)
        return mapOf("data" to serializeScheduledTask(inserted))
    }

    /**
     * Idempotent tenant-level `user_alert_manager` row — mirrors Next
     * `ensureUserAlertManagerScheduledTaskForTenant` when the first NL price alert is created.
     */
    fun ensureUserAlertManagerScheduledTaskForTenant(tenantHex: String) {
        val tenantHexTrim = tenantHex.trim()
        if (tenantHexTrim.isEmpty()) {
            return
        }
        val tenantLevelOnly =
            Criteria().orOperator(
                Criteria.where("portfolioId").exists(false),
                Criteria.where("portfolioId").`is`(null),
            )
        val base =
            Criteria().andOperator(
                Criteria.where("category").`is`("user_alert_manager"),
                tenantLevelOnly,
            )
        val crit = PortfolioMongoFilter.scheduledTaskTenantReadCriteria(base, tenantHexTrim)
        if (mongoTemplate.exists(Query.query(crit), props.scheduledTasksCollection)) {
            return
        }
        val tenantOid = PortfolioMongoFilter.tenantObjectId(tenantHexTrim) ?: return
        val now = Date()
        val cron = "0 14-21 * * 1-5"
        val nextRunAt =
            computeNextRunAt(cron, now) ?: Date(now.time + ONE_HOUR_MS)
        val doc = Document()
        doc["name"] = "User price alert manager"
        doc["category"] = "user_alert_manager"
        doc["scheduleCron"] = cron
        doc["enabled"] = true
        doc["nextRunAt"] = nextRunAt
        doc["tenantId"] = tenantOid
        doc["createdAt"] = now
        doc["updatedAt"] = now
        mongoTemplate.insert(doc, props.scheduledTasksCollection)
    }

    fun getTaskForTenant(taskId: String, session: ResolvedSession): Document? {
        if (!ObjectId.isValid(taskId)) {
            return null
        }
        val oid = ObjectId(taskId)
        val base = Criteria.where("_id").`is`(oid)
        val q = Query.query(PortfolioMongoFilter.scheduledTaskTenantReadCriteria(base, session.tenantId.takeIf { it.isNotBlank() }))
        return mongoTemplate.findOne(q, Document::class.java, props.scheduledTasksCollection)
    }

    /** Tenant-level scheduled tasks only (no `portfolioId`); used for admin hub CRUD. */
    fun getTenantLevelTask(taskId: String, session: ResolvedSession): Document? {
        val doc = getTaskForTenant(taskId, session) ?: return null
        if (doc.getObjectId("portfolioId") != null) {
            return null
        }
        return doc
    }

    fun patchTenantLevelTask(session: ResolvedSession, taskId: String, body: Map<String, Any?>): Map<String, Any?>? {
        val existing = getTenantLevelTask(taskId, session) ?: return null
        val id = existing.getObjectId("_id") ?: return null
        val allowedKeys = setOf("name", "category", "scheduleCron", "enabled", "nextRunAt", "deliveryChannelTarget")
        if (body.keys.none { it in allowedKeys }) {
            throw BadTaskPayloadException("At least one field is required")
        }
        val update = Update()
        var modified = false
        val name = (body["name"] as? String)?.trim()
        if (name != null) {
            if (name.isEmpty()) {
                throw BadTaskPayloadException("name cannot be empty")
            }
            update.set("name", name)
            modified = true
        }
        val category = (body["category"] as? String)?.trim()?.lowercase()
        if (category != null) {
            if (category !in ALLOWED_CATEGORIES) {
                throw BadTaskPayloadException("Invalid category")
            }
            update.set("category", category)
            modified = true
        }
        val scheduleCron = (body["scheduleCron"] as? String)?.trim()
        if (scheduleCron != null) {
            if (!isValidCron(scheduleCron)) {
                throw BadTaskPayloadException("scheduleCron is invalid")
            }
            update.set("scheduleCron", scheduleCron)
            // If nextRunAt is not explicitly provided in the same patch, recompute from now
            if (!body.containsKey("nextRunAt")) {
                val computed = computeNextRunAt(scheduleCron, Date())
                    ?: throw BadTaskPayloadException("scheduleCron could not compute next run")
                update.set("nextRunAt", computed)
            }
            modified = true
        }
        if (body.containsKey("enabled")) {
            val en = body["enabled"] as? Boolean
            if (en == null) {
                throw BadTaskPayloadException("enabled must be boolean")
            }
            update.set("enabled", en)
            modified = true
        }
        if (body.containsKey("nextRunAt")) {
            when (val v = body["nextRunAt"]) {
                null -> {
                    update.set("nextRunAt", null)
                    modified = true
                }
                else -> {
                    val d = parseOptionalDate(v) ?: throw BadTaskPayloadException("nextRunAt is invalid")
                    update.set("nextRunAt", d)
                    modified = true
                }
            }
        }
        if (body.containsKey("deliveryChannelTarget")) {
            when (val v = body["deliveryChannelTarget"]) {
                null -> {
                    update.unset("deliveryChannelTarget")
                    modified = true
                }
                is String -> {
                    if (v.isBlank()) {
                        update.unset("deliveryChannelTarget")
                    } else {
                        update.set("deliveryChannelTarget", assertDeliveryChannelExists(session, v.trim()))
                    }
                    modified = true
                }
                else -> throw BadTaskPayloadException("deliveryChannelTarget invalid")
            }
        }
        if (!modified) {
            return mapOf("data" to serializeScheduledTask(existing))
        }
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(id)),
            update,
            props.scheduledTasksCollection,
        )
        val refreshed = mongoTemplate.findById(id, Document::class.java, props.scheduledTasksCollection)
            ?: return null
        return mapOf("data" to serializeScheduledTask(refreshed))
    }

    fun deleteTenantLevelTask(session: ResolvedSession, taskId: String): Boolean {
        val existing = getTenantLevelTask(taskId, session) ?: return false
        val id = existing.getObjectId("_id") ?: return false
        val res = mongoTemplate.remove(
            Query.query(Criteria.where("_id").`is`(id)),
            props.scheduledTasksCollection,
        )
        return res.deletedCount >= 1L
    }

    fun listTaskRuns(session: ResolvedSession, limit: Int, allTenants: Boolean = false): List<Map<String, Any?>> {
        val lim = limit.coerceIn(1, 500)
        val base = Criteria()
        val tenantFilter: String? = if (allTenants) null else session.tenantId.takeIf { it.isNotBlank() }
        val q = Query.query(PortfolioMongoFilter.withTenantScopeCriteria(base, tenantFilter))
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

    fun executeScheduledTask(task: Document, triggeredBy: String): ExecutionResult = enqueueScheduledTask(task, triggeredBy)

    fun enqueueScheduledTask(
        task: Document,
        triggeredBy: String,
        bypassMarketWindow: Boolean = false,
    ): ExecutionResult {
        return enqueueScheduledTaskInternal(task, triggeredBy, null, advanceSchedule = true, bypassMarketWindow)
    }

    private fun shouldDelegateToNext(category: String): Boolean =
        category != "user-history" && nextSchedulerExecuteClient.isConfigured()

    private fun delegateToNext(
        taskIdHex: String,
        triggeredBy: String,
        bypassMarketWindow: Boolean = false,
    ): ExecutionResult {
        val (runId, status, output) =
            nextSchedulerExecuteClient.executeTask(taskIdHex, triggeredBy, bypassMarketWindow)
        return ExecutionResult(runIdHex = runId, status = status, output = output)
    }

    private fun enqueueScheduledTaskInternal(
        task: Document,
        triggeredBy: String,
        tenantOverride: ObjectId?,
        advanceSchedule: Boolean,
        bypassMarketWindow: Boolean = false,
    ): ExecutionResult {
        val taskId = task.getObjectId("_id") ?: throw IllegalStateException("task missing _id")
        val baseTenantOid = task.getObjectId("tenantId")
        val tenantOid = tenantOverride ?: baseTenantOid
        val taskName = task.getString("name") ?: "task"
        val category = task.getString("category") ?: "sync-broker"

        if (shouldDelegateToNext(category) && !(baseTenantOid == null && tenantOverride != null)) {
            return delegateToNext(taskId.toHexString(), triggeredBy, bypassMarketWindow)
        }

        val runDoc = Document()
        runDoc["taskId"] = taskId
        runDoc["taskName"] = taskName
        runDoc["category"] = category
        runDoc["triggeredBy"] = triggeredBy
        runDoc["output"] = withTenantIdInTaskOutput("Task accepted and started", tenantOid)
        runDoc["status"] = "running"
        runDoc["startedAt"] = Date()
        tenantOid?.let { runDoc["tenantId"] = it }

        val inserted = mongoTemplate.insert(runDoc, props.taskRunsCollection)
        val runId = inserted.getObjectId("_id") ?: throw IllegalStateException("run missing _id")
        val startedAt = inserted.getDate("startedAt") ?: Date()

        if (advanceSchedule) {
            advanceScheduleAfterStart(task, startedAt)
        }

        // Execute asynchronously
        taskExecutor.execute {
            try {
                val (execStatus, execOutput) = when (category) {
                    "user-history" -> userHistoryAgentService.run(tenantOid?.toHexString())
                    else -> simulateTaskExecution(taskName, category)
                }
                val completedAt = Date()
                val durationMs = maxOf(1L, completedAt.time - startedAt.time)
                val outputStored = withTenantIdInTaskOutput(execOutput, tenantOid)
                mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").`is`(runId)),
                    Update().apply {
                        set("status", execStatus)
                        set("output", outputStored)
                        set("durationMs", durationMs)
                        set("completedAt", completedAt)
                    },
                    props.taskRunsCollection,
                )
            } catch (e: Exception) {
                val completedAt = Date()
                val errOut =
                    withTenantIdInTaskOutput(
                        ("Execution error: " + (e.message ?: e.javaClass.simpleName)).take(500),
                        tenantOid,
                    )
                mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").`is`(runId)),
                    Update().apply {
                        set("status", "failed")
                        set("output", errOut)
                        set("completedAt", completedAt)
                    },
                    props.taskRunsCollection,
                )
            }
        }

        return ExecutionResult(
            runIdHex = runId.toHexString(),
            status = "running",
            output = withTenantIdInTaskOutput("Task accepted and started", tenantOid),
        )
    }

    fun listDueTasks(now: Date, session: ResolvedSession): List<Document> {
        val tenantScopedOnly = Criteria().orOperator(
            Criteria.where("portfolioId").exists(false),
            Criteria.where("portfolioId").`is`(null),
        )
        val base = Criteria().andOperator(
            Criteria.where("enabled").`is`(true),
            Criteria.where("nextRunAt").lte(now),
            tenantScopedOnly,
        )
        val q = Query.query(PortfolioMongoFilter.scheduledTaskTenantReadCriteria(base, session.tenantId.takeIf { it.isNotBlank() }))
            .with(Sort.by(Sort.Direction.ASC, "nextRunAt").and(Sort.by(Sort.Direction.ASC, "_id")))
            .limit(30)
        return mongoTemplate.find(q, Document::class.java, props.scheduledTasksCollection)
    }

    /**
     * Due tenant-level tasks across **all** tenants (no session tenant filter). Used by the internal JVM poller so
     * production does not depend on a per-tenant HTTP tick. HTTP `POST /api/admin/scheduler/tick` remains scoped to
     * the signed-in admin’s tenant (see [listDueTasks]).
     */
    fun listAllDueTenantLevelTasks(now: Date): List<Document> {
        val lim = props.scheduler.maxTasksPerPoll.coerceIn(1, 500)
        val tenantScopedOnly = Criteria().orOperator(
            Criteria.where("portfolioId").exists(false),
            Criteria.where("portfolioId").`is`(null),
        )
        val base = Criteria().andOperator(
            Criteria.where("enabled").`is`(true),
            Criteria.where("nextRunAt").lte(now),
            tenantScopedOnly,
        )
        val q = Query.query(base)
            .with(Sort.by(Sort.Direction.ASC, "nextRunAt").and(Sort.by(Sort.Direction.ASC, "_id")))
            .limit(lim)
        return mongoTemplate.find(q, Document::class.java, props.scheduledTasksCollection)
    }

    fun enqueueDueTasks(now: Date, session: ResolvedSession): List<ExecutionResult> {
        val due = listDueTasks(now, session)
        val username = session.username?.takeIf { it.isNotBlank() } ?: session.userId
        return enqueueDueTaskDocuments(due, "scheduler:$username", now)
    }

    /**
     * Cross-tenant poll enqueue; [triggeredBy] on runs is [SYSTEM_SCHEDULER_TRIGGER] for logs and audit parity.
     */
    fun enqueueDueTasksForSystemPoll(now: Date): List<ExecutionResult> {
        val due = listAllDueTenantLevelTasks(now)
        val accepted = mutableListOf<ExecutionResult>()
        for (task in due) {
            val taskId = task.getObjectId("_id") ?: continue
            val lockName = "admin_task_" + taskId.toHexString()
            val cfg = LockConfiguration(Instant.now(), lockName, Duration.ofMinutes(5), Duration.ofSeconds(5))
            val maybeLock = lockProvider.lock(cfg)
            if (maybeLock.isPresent) {
                val simpleLock = maybeLock.get()
                try {
                    val dueTask = refetchDueTenantLevelTask(taskId, now) ?: continue
                    val tenantOid = dueTask.getObjectId("tenantId")
                    val category = dueTask.getString("category") ?: ""
                    if (tenantOid != null) {
                        val res = enqueueScheduledTaskInternal(dueTask, SYSTEM_SCHEDULER_TRIGGER, null, advanceSchedule = true)
                        accepted.add(res)
                    } else if (shouldDelegateToNext(category)) {
                        accepted.add(delegateToNext(taskId.toHexString(), SYSTEM_SCHEDULER_TRIGGER))
                    } else {
                        // Fan-out: run once per tenant when task is system-wide (no tenantId) — JVM stubs only
                        val nowStarted = Date()
                        advanceScheduleAfterStart(dueTask, nowStarted)
                        for (tid in listAllTenantIds()) {
                            val res = enqueueScheduledTaskInternal(dueTask, SYSTEM_SCHEDULER_TRIGGER, tid, advanceSchedule = false)
                            accepted.add(res)
                        }
                    }
                } finally {
                    simpleLock.unlock()
                }
            }
        }
        return accepted
    }

    private fun enqueueDueTaskDocuments(due: List<Document>, triggeredBy: String, now: Date): List<ExecutionResult> {
        val accepted = mutableListOf<ExecutionResult>()
        for (task in due) {
            val taskId = task.getObjectId("_id") ?: continue
            val lockName = "admin_task_" + taskId.toHexString()
            val cfg = LockConfiguration(Instant.now(), lockName, Duration.ofMinutes(5), Duration.ofSeconds(5))
            val maybeLock = lockProvider.lock(cfg)
            if (maybeLock.isPresent) {
                val simpleLock = maybeLock.get()
                try {
                    val dueTask = refetchDueTenantLevelTask(taskId, now) ?: continue
                    val res = enqueueScheduledTask(dueTask, triggeredBy)
                    accepted.add(res)
                } finally {
                    simpleLock.unlock()
                }
            }
        }
        return accepted
    }

    /**
     * Re-check due state inside the per-task lock so stale snapshots from another node cannot enqueue twice.
     */
    private fun refetchDueTenantLevelTask(taskId: ObjectId, now: Date): Document? {
        val tenantLevelOnly = Criteria().orOperator(
            Criteria.where("portfolioId").exists(false),
            Criteria.where("portfolioId").`is`(null),
        )
        val due = Criteria().andOperator(
            Criteria.where("_id").`is`(taskId),
            Criteria.where("enabled").`is`(true),
            Criteria.where("nextRunAt").lte(now),
            tenantLevelOnly,
        )
        return mongoTemplate.findOne(Query.query(due), Document::class.java, props.scheduledTasksCollection)
    }

    class BadTaskPayloadException(message: String) : RuntimeException(message)

    private fun normalizeCronForSpring(cron: String): String {
        val parts = cron.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
        return if (parts.size == 5) {
            // Prepend seconds for Spring's CronExpression
            "0 " + parts.joinToString(" ")
        } else {
            cron.trim()
        }
    }

    private fun isValidCron(cron: String): Boolean = try {
        CronExpression.parse(normalizeCronForSpring(cron))
        true
    } catch (_: Exception) {
        false
    }

    private fun computeNextRunAt(cron: String, from: Date): Date? {
        return try {
            val expr = CronExpression.parse(normalizeCronForSpring(cron))
            val zdt = java.time.ZonedDateTime.ofInstant(from.toInstant(), ZoneId.of("UTC"))
            val next = expr.next(zdt) ?: return null
            Date.from(next.toInstant())
        } catch (_: Exception) {
            null
        }
    }

    private fun advanceScheduleAfterStart(task: Document, startedAt: Date) {
        val taskId = task.getObjectId("_id") ?: return
        val cron = task.getString("scheduleCron")
        val next = if (!cron.isNullOrBlank()) computeNextRunAt(cron, startedAt) else null
        val nextSafe = next ?: Date(startedAt.time + ONE_DAY_MS)
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(taskId)),
            Update().apply {
                set("lastRunAt", startedAt)
                set("nextRunAt", nextSafe)
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
            "watchlist_price_scanner" -> {
                status = "success"
                output =
                    "watchlist_price_scanner: Kotlin worker noop — Yahoo batch + alerts execute on Next.js task-runner."
            }
            "options_scanner" -> {
                status = "success"
                output = optionsStrategyEngine.scheduledTaskDryRunOutput(taskName) +
                    " — full Yahoo/Mongo scanner pass runs on Next.js task-runner when scheduled there."
            }
            "xchat_spend_alert" -> {
                status = "success"
                output =
                    "xchat_spend_alert: Kotlin worker noop — tenant spend alert executes on Next.js task-runner."
            }
            "corporate_events_scanner", "income_cash_flow_projector", "options_expiration_roll_manager",
            "risk_concentration_scanner", "tax_loss_harvest_scanner" -> {
                status = "success"
                output =
                    "Phase 3 scanner: Kotlin worker noop — execution runs on Next.js task-runner (category=$category)."
            }
            else -> {
                status = "failed"
                output = "Unsupported task category for \"$taskName\"."
            }
        }
        return status to output
    }

    fun scheduledTaskToJson(doc: Document): Map<String, Any?> = serializeScheduledTask(doc)

    private fun serializeScheduledTask(doc: Document): Map<String, Any?> {
        val m = mutableMapOf<String, Any?>()
        doc.getObjectId("_id")?.let { m["_id"] = it.toHexString() }
        doc.getObjectId("tenantId")?.let { m["tenantId"] = it.toHexString() }
        doc.getObjectId("portfolioId")?.let { m["portfolioId"] = it.toHexString() }
        m["name"] = doc.getString("name")
        m["category"] = doc.getString("category")
        doc.getString("ownerKind")?.takeIf { it.isNotBlank() }?.let { m["ownerKind"] = it }
        doc.getObjectId("ownerUserId")?.let { m["ownerUserId"] = it.toHexString() }
        m["scheduleCron"] = doc.getString("scheduleCron")
        m["enabled"] = doc.getBoolean("enabled") ?: true
        doc.getObjectId("deliveryChannelTarget")?.let { m["deliveryChannelTarget"] = it.toHexString() }
        (doc["runTimeoutSeconds"] as? Number)?.toInt()?.let { m["runTimeoutSeconds"] = it }
        (doc["maxRetries"] as? Number)?.toInt()?.let { m["maxRetries"] = it }
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

    private fun assertDeliveryChannelExists(session: ResolvedSession, hex: String): ObjectId {
        if (!ObjectId.isValid(hex)) {
            throw BadTaskPayloadException("Invalid deliveryChannelTarget")
        }
        val oid = ObjectId(hex)
        val q = Query.query(
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria.where("_id").`is`(oid),
                session.tenantId.takeIf { it.isNotBlank() },
            ),
        )
        mongoTemplate.findOne(q, Document::class.java, props.adminDeliveryChannelsCollection)
            ?: throw BadTaskPayloadException("deliveryChannelTarget not found")
        return oid
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

    /** Matches Next.js `appendTenantIdToScheduledTaskOutput` for `admin_task_runs.output`. */
    private fun withTenantIdInTaskOutput(output: String, tenantOid: ObjectId?): String {
        val t = output.trimStart()
        if (t.startsWith("tenantId=")) {
            return output
        }
        val label = tenantOid?.toHexString()?.let { hex -> "tenantId=$hex" } ?: "tenantId=none"
        return "$label | $output"
    }

    /** Enumerate all tenant ObjectIds for system-wide task fan-out. */
    private fun listAllTenantIds(): List<ObjectId> {
        val notDeleted = Criteria().orOperator(
            Criteria.where("isDeleted").exists(false),
            Criteria.where("isDeleted").`is`(false),
        )
        val q = Query.query(notDeleted).limit(10000)
        val docs = mongoTemplate.find(q, Document::class.java, "core_tenants")
        val ids = docs.mapNotNull { it.getObjectId("_id") }
        return ids
    }

    companion object {
        const val SYSTEM_SCHEDULER_TRIGGER: String = "system-scheduler"

        private val ALLOWED_CATEGORIES =
            setOf(
                "price_scanner",
                "options_scanner",
                "user_access_requests",
                "sync-broker",
                "rebalance",
                "compliance",
                "notifications",
                "user-history",
                "watchlist_price_scanner",
                "corporate_events_scanner",
                "income_cash_flow_projector",
                "options_expiration_roll_manager",
                "risk_concentration_scanner",
                "tax_loss_harvest_scanner",
                "marketing_post",
                "user_alert_manager",
                "xchat_spend_alert",
            )
        private const val FIVE_MIN_MS = 5L * 60L * 1000L
        private const val ONE_HOUR_MS = 60L * 60L * 1000L
        private const val ONE_DAY_MS = 24L * 60L * 60L * 1000L
    }
}
