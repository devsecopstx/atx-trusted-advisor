package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.BsonJson
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.isGlobalAdmin
import jakarta.servlet.http.HttpServletRequest
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class RagFilesController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val mongoTemplate: MongoTemplate,
) {

    @GetMapping("/api/rag/files")
    fun list(
        request: HttpServletRequest,
        @RequestParam(name = "scope", required = false) scope: String?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.isGlobalAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }
        val parts = mutableListOf<Criteria>()
        scope?.takeIf { it.isNotBlank() }?.let { parts.add(Criteria.where("scope").`is`(it)) }
        if (ObjectId.isValid(session.tenantId)) {
            val tid = ObjectId(session.tenantId)
            parts.add(
                Criteria().orOperator(
                    Criteria.where("tenantId").`is`(tid),
                    Criteria.where("tenantId").exists(false),
                ),
            )
        }
        val crit = if (parts.isEmpty()) {
            Criteria()
        } else {
            Criteria().andOperator(*parts.toTypedArray())
        }
        val q = Query.query(crit).with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(100)
        val docs = mongoTemplate.find(q, Document::class.java, props.ragFilesCollection)
        val data = docs.map { BsonJson.documentToMap(it) }
        return ResponseEntity.ok(mapOf("data" to data))
    }
}
