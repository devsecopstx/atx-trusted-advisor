package com.atxfinance.backend.rag

import com.atxfinance.backend.config.AtxfinanceProperties
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.util.Date

@Service
class RagFileReadinessService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val xaiFileUploadClient: XaiFileUploadClient,
) {

    data class ReadinessPayload(
        val fileId: String,
        val xaiFileId: String?,
        val readiness: String,
        val processingStatus: String,
        val message: String?,
        val checkedAt: String,
    )

    fun pollReadiness(fileId: ObjectId): ReadinessPayload? {
        val doc = mongoTemplate.findById(fileId, Document::class.java, props.ragFilesCollection)
            ?: return null

        val mongoFileId = doc.getObjectId("_id")?.toHexString() ?: ""
        val uploadStatus = doc.getString("xaiUploadStatus") ?: "skipped"
        val xaiFileId = (doc.getString("xaiFileId")?.trim()?.takeIf { it.isNotEmpty() })
            .takeIf { uploadStatus == "uploaded" }
        val now = Date()
        val checkedAt = now.toInstant().toString()

        if (xaiFileId != null) {
            try {
                val meta = xaiFileUploadClient.getFileMetadata(xaiFileId)
                mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").`is`(fileId)),
                    Update()
                        .set("xaiProcessingStatus", meta.processingStatus)
                        .set("xaiProcessingCheckedAt", now)
                        .set("xaiUploadError", meta.uploadErrorMessage),
                    props.ragFilesCollection,
                )
                return evaluate(
                    fileIdHex = mongoFileId,
                    xaiFileId = xaiFileId,
                    xaiUploadStatus = "uploaded",
                    xaiProcessingStatus = meta.processingStatus,
                    xaiUploadError = meta.uploadErrorMessage,
                    checkedAt = checkedAt,
                )
            } catch (_: Exception) {
                mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").`is`(fileId)),
                    Update()
                        .set("xaiProcessingStatus", "unknown")
                        .set("xaiProcessingCheckedAt", now)
                        .set("xaiUploadError", "Failed readiness poll"),
                    props.ragFilesCollection,
                )
                return evaluate(
                    fileIdHex = mongoFileId,
                    xaiFileId = xaiFileId,
                    xaiUploadStatus = "uploaded",
                    xaiProcessingStatus = "unknown",
                    xaiUploadError = "Failed readiness poll",
                    checkedAt = checkedAt,
                )
            }
        }

        val status = doc.getString("xaiProcessingStatus")?.takeIf { it.isNotBlank() } ?: "unknown"
        val uploadError = doc.getString("xaiUploadError")?.trim()?.takeIf { it.isNotEmpty() }
        return evaluate(
            fileIdHex = mongoFileId,
            xaiFileId = doc.getString("xaiFileId"),
            xaiUploadStatus = doc.getString("xaiUploadStatus") ?: "skipped",
            xaiProcessingStatus = status,
            xaiUploadError = uploadError,
            checkedAt = checkedAt,
        )
    }

    private fun evaluate(
        fileIdHex: String,
        xaiFileId: String?,
        xaiUploadStatus: String,
        xaiProcessingStatus: String,
        xaiUploadError: String?,
        checkedAt: String,
    ): ReadinessPayload {
        if (xaiUploadStatus != "uploaded") {
            return ReadinessPayload(
                fileId = fileIdHex,
                xaiFileId = xaiFileId,
                readiness = "not_uploaded",
                processingStatus = xaiProcessingStatus,
                message = "Upload is not completed.",
                checkedAt = checkedAt,
            )
        }
        val status = xaiProcessingStatus.lowercase()
        val (readiness, message) = when (status) {
            "complete", "skipped" -> "ready" to null
            "pending" -> "pending_embeddings" to "Embedding/indexing is pending."
            "processing" -> "processing_embeddings" to "Embedding/indexing is processing."
            "failed" -> "embedding_failed" to (xaiUploadError ?: "Embedding/indexing failed.")
            else -> "unknown" to "Readiness state is unknown."
        }
        return ReadinessPayload(
            fileId = fileIdHex,
            xaiFileId = xaiFileId,
            readiness = readiness,
            processingStatus = status,
            message = message,
            checkedAt = checkedAt,
        )
    }
}
