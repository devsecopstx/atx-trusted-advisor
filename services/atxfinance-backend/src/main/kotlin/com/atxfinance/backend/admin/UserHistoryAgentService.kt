package com.atxfinance.backend.admin

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.rag.XaiCollectionDocumentsClient
import com.atxfinance.backend.rag.XaiFileUploadClient
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant
import java.util.Date
import kotlin.math.min

@Service
class UserHistoryAgentService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val xaiFileUploadClient: XaiFileUploadClient,
    private val xaiCollectionDocumentsClient: XaiCollectionDocumentsClient,
) {

    fun run(tenantIdHex: String?): Pair<String, String> {
        val limit = 50
        val pendingCriteria = Criteria().andOperator(
            Criteria.where("syncedToXaiAt").`is`(null),
            Criteria().orOperator(
                Criteria.where("xaiTurnFileId").`is`(null),
                Criteria.where("xaiTurnFileId").`is`(""),
            ),
            Criteria().orOperator(
                Criteria.where("xaiLongTermSyncSkippedAt").`is`(null),
                Criteria.where("xaiLongTermSyncSkippedAt").exists(false),
            ),
        )
        val q = Query.query(pendingWithTenantScope(pendingCriteria, tenantIdHex))
            .with(Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("_id")))
            .limit(limit)
        val pending = mongoTemplate.find(q, Document::class.java, props.xchatLogsCollection)
        if (pending.isEmpty()) {
            return "success" to "user_history_agent: no pending xchat turns (tenant=${tenantIdHex ?: "all"})."
        }
        var synced = 0
        var skippedNoLongTermConsent = 0
        var failed = 0
        val errors = mutableListOf<String>()
        for (doc in pending) {
            val logId = doc.getObjectId("_id")
            val userIdHex = extractUserIdHex(doc)
            if (logId == null || userIdHex.isNullOrBlank()) {
                failed += 1
                errors.add("skip: missing _id or userId")
                continue
            }
            val logTenant = extractTenantObjectId(doc)
            if (!userOptedInLongTermXaiMemory(userIdHex, logTenant)) {
                markSkippedNoLongTermConsent(logId)
                skippedNoLongTermConsent += 1
                continue
            }
            val message = doc.getString("message")?.trim().orEmpty()
            val response = doc.getString("response")?.trim().orEmpty()
            if (message.isEmpty() && response.isEmpty()) {
                failed += 1
                markSyncFailed(logId, "empty message and response")
                continue
            }
            try {
                val collectionId = resolveUserXaiCollectionId(userIdHex, tenantIdHex)
                    ?: error("no user xAI collection (bootstrap/core_users)")
                val built = buildTurnPayload(doc, userIdHex)
                val upload = xaiFileUploadClient.upload(
                    built.filename,
                    built.markdown.toByteArray(StandardCharsets.UTF_8),
                    "text/markdown",
                )
                xaiCollectionDocumentsClient.linkFileToCollection(collectionId, upload.fileId)
                markSynced(logId, upload.fileId, built.payloadHash, built.retentionExpiresAt)
                synced += 1
            } catch (e: Exception) {
                failed += 1
                val msg = e.message ?: "unknown error"
                errors.add("${logId.toHexString()}: $msg")
                markSyncFailed(logId, msg.take(2000))
            }
        }
        val tail = if (errors.isNotEmpty()) {
            " Errors: " + errors.take(5).joinToString(" | ")
        } else {
            ""
        }
        val status = if (failed > 0 && synced == 0) "failed" else "success"
        return status to "user_history_agent: processed=${pending.size} synced=$synced skipped_no_long_term_consent=$skippedNoLongTermConsent failed=$failed.$tail"
    }

    private fun extractUserIdHex(doc: Document): String? {
        val raw = doc["userId"] ?: return null
        return when (raw) {
            is ObjectId -> raw.toHexString()
            is String -> raw.trim().takeIf { it.isNotEmpty() }
            else -> raw.toString().trim().takeIf { it.isNotEmpty() }
        }
    }

    private fun extractTenantObjectId(doc: Document): ObjectId? {
        val raw = doc["tenantId"] ?: return null
        return when (raw) {
            is ObjectId -> raw
            is String -> raw.trim().takeIf { it.isNotEmpty() && ObjectId.isValid(it) }?.let { ObjectId(it) }
            else -> null
        }
    }

    /** Mirrors Next `userHasLongTermXaiMemoryEnabled` — both flags must be true on `xchat_user_preferences`. */
    private fun userOptedInLongTermXaiMemory(userIdHex: String, logTenant: ObjectId?): Boolean {
        if (!ObjectId.isValid(userIdHex)) {
            return false
        }
        val uid = ObjectId(userIdHex)
        val prefsMatch =
            Criteria.where("userId").`is`(uid)
                .and("keepLastTenMessages").`is`(true)
                .and("enableLongTermXaiMemory").`is`(true)
        val tenantFlex =
            if (logTenant != null) {
                Criteria().orOperator(
                    Criteria.where("tenantId").`is`(logTenant),
                    Criteria.where("tenantId").`is`(null),
                    Criteria.where("tenantId").exists(false),
                )
            } else {
                Criteria().orOperator(
                    Criteria.where("tenantId").`is`(null),
                    Criteria.where("tenantId").exists(false),
                )
            }
        val q =
            Query.query(Criteria().andOperator(prefsMatch, tenantFlex))
                .with(Sort.by(Sort.Direction.DESC, "updatedAt"))
                .limit(1)
        return mongoTemplate.exists(q, props.xchatUserPreferencesCollection)
    }

    private fun resolveUserXaiCollectionId(userIdHex: String, tenantIdHex: String?): String? {
        val bootCriteria = PortfolioMongoFilter.withTenantScopeCriteria(
            PortfolioMongoFilter.userIdCriteria(userIdHex),
            tenantIdHex,
        )
        val profile = mongoTemplate.findOne(
            Query.query(bootCriteria).with(Sort.by(Sort.Direction.DESC, "updatedAt")).limit(1),
            Document::class.java,
            props.adminUserBootstrapProfilesCollection,
        )
        profile?.getString("xaiCollectionId")?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
        if (!ObjectId.isValid(userIdHex)) {
            return null
        }
        val cu = mongoTemplate.findById(ObjectId(userIdHex), Document::class.java, props.coreUsersCollection)
        return cu?.getString("xaiCollectionId")?.trim()?.takeIf { it.isNotEmpty() }
    }

    private data class BuiltTurn(
        val markdown: String,
        val payloadHash: String,
        val retentionExpiresAt: Date,
        val filename: String,
    )

    private fun buildTurnPayload(doc: Document, userIdHex: String): BuiltTurn {
        val createdAt = doc.getDate("createdAt") ?: Date()
        val retentionMs = XCHAT_TURN_RETENTION_DAYS * 24L * 60L * 60L * 1000L
        val retentionExpiresAt = Date(createdAt.time + retentionMs)
        val tenantLabel = doc.getObjectId("tenantId")?.toHexString() ?: "none"
        val persona = doc.getString("personaName")?.trim()?.takeIf { it.isNotEmpty() } ?: "unknown"
        val model = doc.getString("model")?.trim()?.takeIf { it.isNotEmpty() } ?: "unknown"
        val scope = doc.getString("scope")?.trim()?.takeIf { it.isNotEmpty() } ?: "global"
        val prompt = doc.getString("message") ?: ""
        val resp = doc.getString("response") ?: ""
        val md = buildString {
            appendLine("# xChat Prompt/Response")
            appendLine()
            appendLine("userId: $userIdHex")
            appendLine("tenantId: $tenantLabel")
            appendLine("persona: $persona")
            appendLine("model: $model")
            appendLine("scope: $scope")
            appendLine("createdAt: ${Instant.ofEpochMilli(createdAt.time).toString()}")
            appendLine("retentionDays: $XCHAT_TURN_RETENTION_DAYS")
            appendLine("retentionExpiresAt: ${Instant.ofEpochMilli(retentionExpiresAt.time).toString()}")
            appendLine()
            appendLine("## Prompt")
            appendLine(prompt)
            appendLine()
            appendLine("## Response")
            appendLine(resp)
        }
        val hash = sha256Hex(md)
        val suffix = if (userIdHex.length >= 8) userIdHex.takeLast(8) else userIdHex.padStart(8, '0')
        val filename = "xchat-turn-${fileTs(createdAt)}-$suffix.md"
        return BuiltTurn(md, hash, retentionExpiresAt, filename)
    }

    private fun fileTs(d: Date): String =
        Instant.ofEpochMilli(d.time).toString().replace(":", "-").replace(".", "-")

    /** Align with TS `withTenantScopeForLogs`: tenant match OR legacy docs without tenantId. */
    private fun pendingWithTenantScope(base: Criteria, tenantIdHex: String?): Criteria {
        if (tenantIdHex.isNullOrBlank()) {
            return base
        }
        val oid = PortfolioMongoFilter.tenantObjectId(tenantIdHex) ?: return base
        val tenantOr = Criteria().orOperator(
            Criteria.where("tenantId").`is`(oid),
            Criteria.where("tenantId").exists(false),
            Criteria.where("tenantId").`is`(null),
        )
        return Criteria().andOperator(base, tenantOr)
    }

    private fun sha256Hex(s: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        val bytes = md.digest(s.toByteArray(StandardCharsets.UTF_8))
        return bytes.joinToString("") { b -> "%02x".format(b) }
    }

    private fun markSynced(
        logId: ObjectId,
        fileId: String,
        payloadHash: String,
        retentionExpiresAt: Date,
    ) {
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(logId)),
            Update().apply {
                set("xaiTurnFileId", fileId)
                set("xaiTurnPayloadHash", payloadHash)
                set("xaiTurnRetentionExpiresAt", retentionExpiresAt)
                set("syncedToXaiAt", Date())
                set("xaiTurnSyncError", null)
                unset("xaiLongTermSyncSkippedAt")
            },
            props.xchatLogsCollection,
        )
    }

    private fun markSyncFailed(logId: ObjectId, err: String) {
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(logId)),
            Update().set("xaiTurnSyncError", err.take(min(err.length, 2000))),
            props.xchatLogsCollection,
        )
    }

    private fun markSkippedNoLongTermConsent(logId: ObjectId) {
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(logId)),
            Update().apply {
                set("xaiLongTermSyncSkippedAt", Date())
                set("xaiTurnSyncError", null)
            },
            props.xchatLogsCollection,
        )
    }

    companion object {
        private const val XCHAT_TURN_RETENTION_DAYS = 30
    }
}
