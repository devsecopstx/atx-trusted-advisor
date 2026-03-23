package com.atxfinance.backend.rag

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.BsonJson
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.nio.charset.StandardCharsets
import java.util.Date

@Service
class RagFileUploadService(
    private val props: AtxfinanceProperties,
    private val mongoTemplate: MongoTemplate,
    private val xaiFileUploadClient: XaiFileUploadClient,
) {
    companion object {
        private const val MAX_BYTES = 5 * 1024 * 1024
        private const val MAX_PREVIEW = 1200
    }

    fun upload(session: ResolvedSession, file: MultipartFile, scopeRaw: String?): Map<String, Any?> {
        if (file.isEmpty) {
            throw IllegalArgumentException("Missing file upload")
        }
        if (file.size > MAX_BYTES) {
            throw PayloadTooLargeException("File too large. Max bytes: $MAX_BYTES")
        }
        val scope = scopeRaw?.trim()?.takeIf { it.isNotEmpty() } ?: "global"
        val filename = file.originalFilename ?: "upload.bin"
        val mimeType = (file.contentType ?: "application/octet-stream").ifBlank { "application/octet-stream" }
        val bytes = file.bytes

        var xaiFileId: String? = null
        var xaiUploadStatus = "skipped"
        var xaiProcessingStatus = "unknown"
        var xaiUploadError: String? = null

        try {
            val upload = xaiFileUploadClient.upload(filename, bytes, mimeType)
            xaiFileId = upload.fileId
            xaiUploadStatus = "uploaded"
            xaiProcessingStatus = upload.processingStatus
        } catch (e: Exception) {
            xaiUploadStatus = "failed"
            xaiProcessingStatus = "failed"
            xaiUploadError = e.message ?: "Unknown upload error"
        }

        val now = Date()
        val userId = if (ObjectId.isValid(session.userId)) ObjectId(session.userId) else null
        val tenantId = if (ObjectId.isValid(session.tenantId)) ObjectId(session.tenantId) else null
        val contentText =
            if (RagMime.isTextLike(mimeType)) {
                String(bytes, StandardCharsets.UTF_8)
            } else {
                ""
            }
        val contentPreview = contentText.take(MAX_PREVIEW)

        val doc = Document()
        doc["_id"] = ObjectId()
        userId?.let { doc["userId"] = it }
        tenantId?.let { doc["tenantId"] = it }
        doc["userEmail"] = session.email
        doc["filename"] = filename
        doc["mimeType"] = mimeType
        doc["sizeBytes"] = file.size
        doc["uploadedBy"] = session.username
        doc["scope"] = scope
        xaiFileId?.let { doc["xaiFileId"] = it }
        doc["xaiUploadStatus"] = xaiUploadStatus
        doc["xaiProcessingStatus"] = xaiProcessingStatus
        doc["xaiProcessingCheckedAt"] = now
        xaiUploadError?.let { doc["xaiUploadError"] = it }
        doc["contentPreview"] = contentPreview
        doc["createdAt"] = now

        mongoTemplate.insert(doc, props.ragFilesCollection)

        val fileId = doc.getObjectId("_id")
        if (contentText.isNotBlank()) {
            val chunks = RagTextChunker.chunkText(contentText)
            if (chunks.isNotEmpty()) {
                val chunkDocs = chunks.mapIndexed { index, chunk ->
                    Document().apply {
                        this["fileId"] = fileId
                        userId?.let { this["userId"] = it }
                        tenantId?.let { this["tenantId"] = it }
                        this["scope"] = scope
                        this["chunkIndex"] = index
                        this["text"] = chunk.text
                        this["tokenEstimate"] = chunk.tokenEstimate
                        this["createdAt"] = now
                    }
                }
                mongoTemplate.insert(chunkDocs, props.ragChunksCollection)
            }
        }

        return BsonJson.documentToMap(doc)
    }

    class PayloadTooLargeException(message: String) : RuntimeException(message)
}
