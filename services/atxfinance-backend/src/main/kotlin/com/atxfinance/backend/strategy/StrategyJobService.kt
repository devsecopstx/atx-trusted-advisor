package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.beans.factory.ObjectProvider
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.util.Date
import java.util.UUID

private data class SlotDef(
    val key: String,
    val prompt: String,
    val choices: List<String>?,
)

@Service
class StrategyJobService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val strategyJobRedisQuota: ObjectProvider<StrategyJobRedisQuota>,
    private val finalizerCoordinator: ObjectProvider<StrategyJobFinalizerCoordinator>,
) {

    fun createJob(
        session: ResolvedSession,
        emailAccountIdRaw: String?,
        idempotencyKey: String?,
    ): CreateJobOutcome {
        val emailAccountId = normalizeEmailAccountId(session, emailAccountIdRaw)

        if (!idempotencyKey.isNullOrBlank()) {
            val idemSince = Date(System.currentTimeMillis() - IDEMPOTENCY_WINDOW_MS)
            val existing = mongoTemplate.findOne(
                Query.query(
                    Criteria.where("userId").`is`(session.userId)
                        .and("tenantId").`is`(session.tenantId)
                        .and("emailAccountId").`is`(emailAccountId)
                        .and("idempotencyKey").`is`(idempotencyKey.trim())
                        .and("createdAt").gte(idemSince),
                ),
                Document::class.java,
                props.strategyJobsCollection,
            )
            if (existing != null) {
                return CreateJobOutcome.Idempotent(existing)
            }
        }

        val quota = strategyJobRedisQuota.ifAvailable
        val since = Date(System.currentTimeMillis() - HOUR_MS)
        val softWarn: Boolean
        val jobsInLastHourAfterCreate: Int
        if (quota != null) {
            val after = quota.tryReserveSlot(session.tenantId, session.userId, emailAccountId)
                ?: return CreateJobOutcome.RateLimited
            val mongoCount = countJobsSince(session, emailAccountId, since)
            softWarn = mongoCount >= props.strategySoftWarnJobsHourly
            jobsInLastHourAfterCreate = maxOf(after, mongoCount + 1L).toInt()
        } else {
            val count = countJobsSince(session, emailAccountId, since)
            if (count >= props.strategyMaxJobsHourly) {
                return CreateJobOutcome.RateLimited
            }
            softWarn = count >= props.strategySoftWarnJobsHourly
            jobsInLastHourAfterCreate = count + 1
        }

        val id = ObjectId()
        val correlationId = UUID.randomUUID().toString()
        val now = Date()
        val firstKey = SLOT_ORDER.first()
        val doc = Document()
        doc["_id"] = id
        doc["userId"] = session.userId
        doc["tenantId"] = session.tenantId
        doc["emailAccountId"] = emailAccountId
        doc["correlationId"] = correlationId
        doc["status"] = STATUS_COLLECTING
        doc["slots"] = Document()
        doc["currentSlotKey"] = firstKey
        doc["turns"] = emptyList<Document>()
        doc["createdAt"] = now
        doc["updatedAt"] = now
        val ttlDays = props.strategyJobsTtlDays
        if (ttlDays > 0) {
            doc["expiresAt"] = Date(now.time + ttlDays * 86_400_000L)
        }
        if (!idempotencyKey.isNullOrBlank()) {
            doc["idempotencyKey"] = idempotencyKey.trim()
        }
        try {
            mongoTemplate.insert(doc, props.strategyJobsCollection)
        } catch (e: Exception) {
            quota?.releaseSlot(session.tenantId, session.userId, emailAccountId)
            throw e
        }
        return CreateJobOutcome.Created(
            doc = doc,
            softWarn = softWarn,
            jobsInLastHourAfterCreate = jobsInLastHourAfterCreate,
        )
    }

    fun listJobs(session: ResolvedSession, emailAccountIdRaw: String?, limitRaw: Int?): List<Document> {
        val email = normalizeEmailAccountId(session, emailAccountIdRaw)
        val limit = (limitRaw ?: 20).coerceIn(1, 50)
        val q = Query.query(
            Criteria.where("userId").`is`(session.userId)
                .and("tenantId").`is`(session.tenantId)
                .and("emailAccountId").`is`(email),
        )
            .with(Sort.by(Sort.Direction.DESC, "createdAt"))
            .limit(limit)
        return mongoTemplate.find(q, Document::class.java, props.strategyJobsCollection)
    }

    fun getJob(session: ResolvedSession, jobId: String, emailAccountIdRaw: String?): Document? {
        if (!ObjectId.isValid(jobId)) {
            return null
        }
        val doc = mongoTemplate.findById(ObjectId(jobId), Document::class.java, props.strategyJobsCollection)
            ?: return null
        if (doc.getString("userId") != session.userId || doc.getString("tenantId") != session.tenantId) {
            return null
        }
        val expectedEmail = normalizeEmailAccountId(session, emailAccountIdRaw)
        if (doc.getString("emailAccountId") != expectedEmail) {
            return null
        }
        return doc
    }

    fun postTurn(
        session: ResolvedSession,
        jobId: String,
        message: String?,
        choiceIndex: Int?,
        emailAccountIdRaw: String?,
    ): PostTurnOutcome {
        if (!ObjectId.isValid(jobId)) {
            return PostTurnOutcome.NotFound
        }
        val doc = mongoTemplate.findById(ObjectId(jobId), Document::class.java, props.strategyJobsCollection)
            ?: return PostTurnOutcome.NotFound
        if (doc.getString("userId") != session.userId || doc.getString("tenantId") != session.tenantId) {
            return PostTurnOutcome.NotFound
        }
        val expectedEmail = normalizeEmailAccountId(session, emailAccountIdRaw)
        if (doc.getString("emailAccountId") != expectedEmail) {
            return PostTurnOutcome.NotFound
        }
        if (doc.getString("status") != STATUS_COLLECTING) {
            return PostTurnOutcome.BadRequest(mapOf("error" to "job_not_collecting", "status" to doc.getString("status")))
        }
        val currentKey = doc.getString("currentSlotKey") ?: return PostTurnOutcome.BadRequest(
            mapOf("error" to "no_current_slot"),
        )
        val def = slotByKey[currentKey] ?: return PostTurnOutcome.BadRequest(mapOf("error" to "unknown_slot"))
        val slots = doc.get("slots", Document::class.java) ?: Document()

        val raw = resolveSlotValue(def, message, choiceIndex)
            ?: return PostTurnOutcome.BadRequest(mapOf("error" to "invalid_turn_payload"))

        val turn = Document(mapOf("at" to Date(), "slotKey" to currentKey, "raw" to raw))
        @Suppress("UNCHECKED_CAST")
        val turns = (doc["turns"] as? List<Document>)?.toMutableList() ?: mutableListOf()
        turns.add(turn)

        slots[currentKey] = raw
        val nextKey = SLOT_ORDER.firstOrNull { key -> !slots.containsKey(key) }
        val now = Date()
        val newStatus = if (nextKey == null) STATUS_SLOTS_COMPLETE else STATUS_COLLECTING

        val update = Update()
            .set("slots", slots)
            .set("currentSlotKey", nextKey)
            .set("status", newStatus)
            .set("turns", turns)
            .set("updatedAt", now)
        if (newStatus == STATUS_SLOTS_COMPLETE) {
            update.set("artifactStatus", "pending")
        }
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(doc.getObjectId("_id"))),
            update,
            props.strategyJobsCollection,
        )

        val updated = mongoTemplate.findById(doc.getObjectId("_id"), Document::class.java, props.strategyJobsCollection)
            ?: return PostTurnOutcome.NotFound
        if (newStatus == STATUS_SLOTS_COMPLETE) {
            finalizerCoordinator.ifAvailable?.onSlotsComplete(session, jobId)
        }
        return PostTurnOutcome.Ok(updated)
    }

    private fun countJobsSince(session: ResolvedSession, emailAccountId: String, since: Date): Int =
        mongoTemplate.count(
            Query.query(
                Criteria.where("userId").`is`(session.userId)
                    .and("tenantId").`is`(session.tenantId)
                    .and("emailAccountId").`is`(emailAccountId)
                    .and("createdAt").gte(since),
            ),
            props.strategyJobsCollection,
        ).toInt()

    private fun resolveSlotValue(def: SlotDef, message: String?, choiceIndex: Int?): String? {
        if (def.choices != null && def.choices.isNotEmpty()) {
            val idx = choiceIndex ?: message?.trim()?.toIntOrNull()
            if (idx == null || idx < 1 || idx > def.choices.size) {
                return null
            }
            return def.choices[idx - 1]
        }
        val m = message?.trim().orEmpty()
        if (m.isEmpty() || m.length > 2000) {
            return null
        }
        return m
    }

    companion object {
        private const val HOUR_MS = 3_600_000L
        private const val IDEMPOTENCY_WINDOW_MS = 86_400_000L
        const val STATUS_COLLECTING = "collecting"
        const val STATUS_SLOTS_COMPLETE = "slots_complete"

        private val SLOT_ORDER = listOf("outlook", "risk", "horizon", "underlying", "capital")

        private val SLOTS: List<SlotDef> = listOf(
            SlotDef(
                "outlook",
                "What is your market outlook?",
                listOf("Bullish", "Neutral", "Bearish"),
            ),
            SlotDef(
                "risk",
                "What risk tolerance should we assume?",
                listOf("Conservative", "Moderate", "Aggressive"),
            ),
            SlotDef(
                "horizon",
                "Investment horizon?",
                listOf("< 3 months", "3–12 months", "1+ years"),
            ),
            SlotDef(
                "underlying",
                "Primary underlying or symbol focus (ticker, e.g. TSLA)?",
                null,
            ),
            SlotDef(
                "capital",
                "Approximate capital to deploy (USD, short text)?",
                null,
            ),
        )

        private val slotByKey: Map<String, SlotDef> = SLOTS.associateBy { it.key }

        fun normalizeEmailAccountId(session: ResolvedSession, raw: String?): String {
            val trimmed = raw?.trim().orEmpty()
            if (trimmed.isNotEmpty()) {
                return trimmed.take(256)
            }
            val email = session.email?.trim()?.lowercase()
            if (!email.isNullOrEmpty()) {
                return email.take(256)
            }
            return "primary"
        }

        fun nextPromptFor(doc: Document): Map<String, Any?> {
            val status = doc.getString("status") ?: ""
            val currentKey = doc.getString("currentSlotKey")
            return when {
                status == STATUS_SLOTS_COMPLETE -> mapOf(
                    "nextPrompt" to null,
                    "nextChoices" to null,
                    "currentSlotKey" to null,
                )
                currentKey != null -> {
                    val def = slotByKey[currentKey]
                    mapOf(
                        "nextPrompt" to def?.prompt,
                        "nextChoices" to def?.choices,
                        "currentSlotKey" to currentKey,
                    )
                }
                else -> mapOf(
                    "nextPrompt" to null,
                    "nextChoices" to null,
                    "currentSlotKey" to null,
                )
            }
        }
    }
}

sealed class CreateJobOutcome {
    data class Created(
        val doc: Document,
        val softWarn: Boolean,
        val jobsInLastHourAfterCreate: Int,
    ) : CreateJobOutcome()

    data class Idempotent(val doc: Document) : CreateJobOutcome()
    data object RateLimited : CreateJobOutcome()
}

sealed class PostTurnOutcome {
    data class Ok(val doc: Document) : PostTurnOutcome()
    data object NotFound : PostTurnOutcome()
    data class BadRequest(val body: Map<String, Any?>) : PostTurnOutcome()
}
