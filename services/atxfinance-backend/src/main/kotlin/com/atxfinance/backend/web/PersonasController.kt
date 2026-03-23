package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.persona.PersonaPayloadException
import com.atxfinance.backend.persona.PersonaService
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.isGlobalAdmin
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class PersonasController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val personaService: PersonaService,
) {

    @GetMapping("/api/personas")
    fun listPersonas(
        request: HttpServletRequest,
        @RequestParam(name = "status", required = false) status: String?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))

        val docs = personaService.listPersonas(session, status)
        val admin = session.isGlobalAdmin()
        val ids = docs.mapNotNull { it.getObjectId("_id")?.toHexString() }
        val latestById = if (admin && ids.isNotEmpty()) {
            personaService.loadLatestAuditByPersonaIds(ids)
        } else {
            emptyMap()
        }
        val data = docs.map { doc ->
            val m = LinkedHashMap<String, Any?>(PersonaService.serializePersona(doc))
            val pid = doc.getObjectId("_id")?.toHexString()
            val ev = if (pid != null && admin) latestById[pid] else null
            m["latestAuditEvent"] = ev?.let { PersonaService.serializeAuditBrief(it) }
            m
        }
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PostMapping("/api/personas")
    fun createPersona(
        request: HttpServletRequest,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.isGlobalAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }
        if (payloadTooLarge(request)) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(mapOf("error" to "Persona payload too large"))
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON payload"))
        }
        return try {
            val doc = personaService.createPersona(body)
            ResponseEntity.status(HttpStatus.CREATED).body(mapOf("data" to PersonaService.serializePersona(doc)))
        } catch (ex: PersonaPayloadException) {
            personaErrorResponse(ex)
        }
    }

    @GetMapping("/api/personas/{personaId}")
    fun getPersona(
        request: HttpServletRequest,
        @PathVariable personaId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.isGlobalAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }
        val doc = personaService.getPersonaById(personaId)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Persona not found"))
        val trail = personaService.listAuditTrailForPersona(personaId).map { PersonaService.serializeAuditBrief(it) }
        val data = LinkedHashMap<String, Any?>(PersonaService.serializePersona(doc))
        data["auditTrail"] = trail
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PutMapping("/api/personas/{personaId}")
    fun putPersona(
        request: HttpServletRequest,
        @PathVariable personaId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.isGlobalAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }
        if (payloadTooLarge(request)) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(mapOf("error" to "Persona payload too large"))
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON payload"))
        }
        return try {
            val doc = personaService.updatePersona(personaId, body)
            ResponseEntity.ok(mapOf("data" to PersonaService.serializePersona(doc)))
        } catch (ex: PersonaPayloadException) {
            personaErrorResponse(ex)
        }
    }

    @DeleteMapping("/api/personas/{personaId}")
    fun deletePersona(
        request: HttpServletRequest,
        @PathVariable personaId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.isGlobalAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }
        val ok = personaService.deletePersona(personaId)
        if (!ok) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Persona not found"))
        }
        return ResponseEntity.ok(mapOf("ok" to true))
    }

    private fun payloadTooLarge(request: HttpServletRequest): Boolean {
        val len = request.contentLengthLong
        return len > 0 && len > 32 * 1024
    }

    private fun personaErrorResponse(ex: PersonaPayloadException): ResponseEntity<Map<String, Any?>> =
        when (ex.status) {
            400 -> ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("error" to "Invalid persona payload", "details" to mapOf("message" to ex.code)),
            )
            404 -> ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Persona not found"))
            409 -> ResponseEntity.status(HttpStatus.CONFLICT).body(
                mapOf(
                    "error" to "A persona with that name already exists",
                    "code" to "PERSONA_NAME_CONFLICT",
                ),
            )
            else -> ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(mapOf("error" to "Unexpected"))
        }
}
