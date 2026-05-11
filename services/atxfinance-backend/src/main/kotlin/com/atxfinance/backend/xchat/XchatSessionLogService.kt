package com.atxfinance.backend.xchat

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.stereotype.Service
import java.security.MessageDigest
import java.util.Date

@Service
class XchatSessionLogService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    fun saveTurn(
        session: ResolvedSession,
        threadId: String,
        requestId: String,
        correlationId: String,
        persona: Document?,
        message: String,
        response: String,
        model: String,
        xaiResponseId: String?,
        xaiUsage: XchatXaiUsageSnapshot?,
        toolCalls: List<Map<String, Any?>>,
        interactionGenerationMs: Long,
    ): String? {
        if (!ObjectId.isValid(session.userId)) {
            return null
        }
        val now = Date()
        val retentionExpiresAt = Date(now.time + OPT_IN_RETENTION_DAYS * 24L * 60L * 60L * 1000L)
        val doc = Document()
        doc["threadId"] = threadId
        doc["requestId"] = requestId
        doc["correlationId"] = correlationId
        doc["userId"] = ObjectId(session.userId)
        PortfolioMongoFilter.tenantObjectId(session.tenantId)?.let { doc["tenantId"] = it }
        session.email?.trim()?.takeIf { it.isNotEmpty() }?.let { doc["userEmail"] = it }
        session.username?.trim()?.takeIf { it.isNotEmpty() }?.let { doc["requestedBy"] = it }
        persona?.getObjectId("_id")?.let { doc["personaId"] = it }
        persona?.getString("name")?.let { doc["personaName"] = it }
        doc["message"] = message
        doc["response"] = response
        doc["contextChunkIds"] = emptyList<Any>()
        doc["model"] = model
        xaiResponseId?.trim()?.takeIf { it.isNotEmpty() }?.let { doc["xaiResponseId"] = it }
        xaiUsage?.let { usage ->
            val usageDoc = Document()
            usageDoc["inputTokens"] = usage.inputTokens
            usageDoc["outputTokens"] = usage.outputTokens
            usageDoc["totalTokens"] = usage.totalTokens
            usage.reasoningTokens?.let { usageDoc["reasoningTokens"] = it }
            usage.cachedPromptTokens?.let { usageDoc["cachedPromptTokens"] = it }
            usage.costUsdTicks?.let { usageDoc["costUsdTicks"] = it }
            doc["xaiUsage"] = usageDoc
        }
        if (toolCalls.isNotEmpty()) {
            doc["xapiToolCalls"] =
                toolCalls.map { call ->
                    val row = Document()
                    row["name"] = call["name"]?.toString() ?: "unknown"
                    row["args"] = call["args"]
                    val result = call["result"]?.toString().orEmpty()
                    if (result.isNotEmpty()) {
                        row["resultHash"] = sha256Hex(result)
                    }
                    row["durationMs"] = (call["durationMs"] as? Number)?.toInt() ?: 0
                    call["error"]?.toString()?.takeIf { it.isNotEmpty() }?.let { row["error"] = it }
                    row
                }
        }
        doc["interactionGenerationMs"] = interactionGenerationMs.coerceAtLeast(0)
        doc["createdAt"] = now
        doc["retentionExpiresAt"] = retentionExpiresAt
        mongoTemplate.insert(doc, props.xchatLogsCollection)
        return doc.getObjectId("_id")?.toHexString()
    }

    private fun sha256Hex(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { byte -> "%02x".format(byte) }
    }

    companion object {
        private const val OPT_IN_RETENTION_DAYS = 60
    }
}
