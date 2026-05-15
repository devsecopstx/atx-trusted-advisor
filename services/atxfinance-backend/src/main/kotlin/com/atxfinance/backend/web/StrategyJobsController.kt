package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.BsonJson
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.canUserLogin
import com.atxfinance.backend.strategy.CreateJobOutcome
import com.atxfinance.backend.strategy.PostTurnOutcome
import com.atxfinance.backend.strategy.StrategyJobFinalizerCoordinator
import com.atxfinance.backend.strategy.StrategyJobService
import jakarta.servlet.http.HttpServletRequest
import org.bson.Document
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class StrategyJobsController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val strategyJobService: StrategyJobService,
    private val finalizerCoordinator: StrategyJobFinalizerCoordinator,
) {

    @GetMapping("/api/strategy-jobs")
    fun list(
        request: HttpServletRequest,
        @RequestParam(name = "emailAccountId", required = false) emailAccountId: String?,
        @RequestParam(name = "limit", required = false) limit: Int?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.canUserLogin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }
        val docs = strategyJobService.listJobs(session, emailAccountId, limit)
        val jobs = docs.map { jobToDataMap(it) }
        return ResponseEntity.ok(mapOf("data" to mapOf("jobs" to jobs)))
    }

    @PostMapping("/api/strategy-jobs")
    fun create(
        request: HttpServletRequest,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.canUserLogin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }
        val emailAccountId = body?.get("emailAccountId") as? String
        val jobType = body?.get("jobType") as? String
        val idempotencyKey = request.getHeader("Idempotency-Key")?.trim()?.takeIf { it.isNotEmpty() }
        when (
            val outcome = strategyJobService.createJob(
                session = session,
                emailAccountIdRaw = emailAccountId,
                idempotencyKey = idempotencyKey,
                jobTypeRaw = jobType,
            )
        ) {
            CreateJobOutcome.RateLimited -> {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(
                    mapOf(
                        "error" to "rate_limited",
                        "message" to "Strategy job hourly limit reached",
                    ),
                )
            }
            is CreateJobOutcome.Idempotent -> {
                return ResponseEntity.ok(
                    mapOf(
                        "data" to jobToDataMap(outcome.doc),
                        "meta" to mapOf("idempotentReplay" to true),
                    ),
                )
            }
            is CreateJobOutcome.Created -> {
                val meta = mutableMapOf<String, Any?>(
                    "jobsInLastHour" to outcome.jobsInLastHourAfterCreate,
                    "softWarnThreshold" to props.strategySoftWarnJobsHourly,
                    "maxJobsHourly" to props.strategyMaxJobsHourly,
                )
                if (outcome.softWarn) {
                    meta["softWarn"] = true
                }
                return ResponseEntity.status(HttpStatus.CREATED).body(
                    mapOf(
                        "data" to jobToDataMap(outcome.doc),
                        "meta" to meta,
                    ),
                )
            }
        }
    }

    @GetMapping("/api/strategy-jobs/{jobId}")
    fun getOne(
        request: HttpServletRequest,
        @PathVariable jobId: String,
        @RequestParam(name = "emailAccountId", required = false) emailAccountId: String?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.canUserLogin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }
        val doc = strategyJobService.getJob(session, jobId, emailAccountId)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Not found"))
        return ResponseEntity.ok(mapOf("data" to jobToDataMap(doc)))
    }

    @PostMapping("/api/strategy-jobs/{jobId}/turns")
    fun postTurn(
        request: HttpServletRequest,
        @PathVariable jobId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.canUserLogin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON"))
        }
        val message = body["message"] as? String
        val emailAccountId = body["emailAccountId"] as? String
        val choice = when (val c = body["choice"]) {
            is Int -> c
            is Number -> c.toInt()
            else -> null
        }
        when (val outcome = strategyJobService.postTurn(session, jobId, message, choice, emailAccountId)) {
            PostTurnOutcome.NotFound -> {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Not found"))
            }
            is PostTurnOutcome.BadRequest -> {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(outcome.body)
            }
            is PostTurnOutcome.Ok -> {
                return ResponseEntity.ok(mapOf("data" to jobToDataMap(outcome.doc)))
            }
        }
    }

    @GetMapping("/api/strategy-jobs/{jobId}/artifact")
    fun getArtifact(
        request: HttpServletRequest,
        @PathVariable jobId: String,
        @RequestParam(name = "emailAccountId", required = false) emailAccountId: String?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.canUserLogin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }
        finalizerCoordinator.ensureFinalizeScheduled(session, jobId)
        val doc = strategyJobService.getJob(session, jobId, emailAccountId)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Not found"))
        if (doc.getString("status") != StrategyJobService.STATUS_SLOTS_COMPLETE) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf(
                    "error" to "artifact_not_ready",
                    "message" to "Job must be slots_complete to fetch an artifact",
                    "status" to doc.getString("status"),
                ),
            )
        }
        val st = doc.getString("artifactStatus")?.trim()?.takeIf { it.isNotEmpty() } ?: "pending"
        val data = mutableMapOf<String, Any?>(
            "artifactStatus" to st,
            "jobId" to doc.getObjectId("_id").toHexString(),
            "correlationId" to doc.getString("correlationId"),
        )
        when (st) {
            "ready" -> {
                data["artifactMarkdown"] = doc.getString("artifactMarkdown")
                val jsonDoc = doc.get("artifactJson", Document::class.java)
                data["artifactJson"] = jsonDoc?.let { BsonJson.documentToMap(it) }
                data["artifactModel"] = doc.getString("artifactModel")
            }
            "failed" -> {
                data["errorCode"] = doc.getString("artifactErrorCode")
                data["errorMessage"] = doc.getString("artifactErrorMessage")
            }
        }
        return ResponseEntity.ok(mapOf("data" to data))
    }

    private fun jobToDataMap(doc: Document): Map<String, Any?> {
        val slots = doc.get("slots", Document::class.java) ?: Document()
        @Suppress("UNCHECKED_CAST")
        val turnsRaw = doc["turns"] as? List<*> ?: emptyList<Any>()
        val turns = turnsRaw.mapNotNull { row ->
            when (row) {
                is Document -> BsonJson.documentToMap(row)
                else -> null
            }
        }
        val prompt = StrategyJobService.nextPromptFor(doc)
        val createdAt = doc.getDate("createdAt")?.time
        val updatedAt = doc.getDate("updatedAt")?.time
        return buildMap {
            put("jobId", doc.getObjectId("_id").toHexString())
            put("correlationId", doc.getString("correlationId"))
            put("status", doc.getString("status"))
            doc.getString("jobType")?.let { put("jobType", it) }
            if (createdAt != null) {
                put("createdAt", createdAt)
            }
            if (updatedAt != null) {
                put("updatedAt", updatedAt)
            }
            put("slots", BsonJson.documentToMap(slots))
            put("turns", turns)
            doc.getString("artifactStatus")?.let { put("artifactStatus", it) }
            putAll(prompt)
        }
    }
}
