package com.atxfinance.backend.web

import com.atxfinance.backend.admin.AdminPortfoliosService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.isGlobalAdmin
import jakarta.servlet.http.HttpServletRequest
import org.bson.types.ObjectId
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class AdminPortfoliosController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val adminPortfoliosService: AdminPortfoliosService,
) {

    @GetMapping("/api/admin/portfolios")
    fun list(request: HttpServletRequest): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        val data = adminPortfoliosService.listPortfoliosWithStats(200)
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PostMapping("/api/admin/portfolios")
    fun create(
        request: HttpServletRequest,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val g = adminGate(request)
        if (g is AdminGate.Err) {
            return g.response
        }
        g as AdminGate.Ok
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        return when (val r = adminPortfoliosService.createPortfolio(g.session, body)) {
            is AdminPortfoliosService.Result.Created ->
                ResponseEntity.status(HttpStatus.CREATED).body(mapOf("data" to r.data))
            is AdminPortfoliosService.Result.Err ->
                errResponse(r.status, r.error, r.details)
            else ->
                ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(mapOf("error" to "Unexpected"))
        }
    }

    @GetMapping("/api/admin/portfolios/{portfolioId}")
    fun getOne(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
    ): ResponseEntity<Map<String, Any?>> {
        when (val g = adminGate(request)) {
            is AdminGate.Err -> return g.response
            is AdminGate.Ok -> Unit
        }
        if (!ObjectId.isValid(portfolioId)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid portfolio id"))
        }
        val data = adminPortfoliosService.getPortfolioWithStats(portfolioId)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PatchMapping("/api/admin/portfolios/{portfolioId}")
    fun patch(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val g = adminGate(request)
        if (g is AdminGate.Err) {
            return g.response
        }
        g as AdminGate.Ok
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("error" to "Invalid JSON body"))
        }
        return when (val r = adminPortfoliosService.patchPortfolio(g.session, portfolioId, body)) {
            is AdminPortfoliosService.Result.Ok ->
                ResponseEntity.ok(mapOf("data" to r.data))
            is AdminPortfoliosService.Result.Err ->
                errResponse(r.status, r.error, r.details)
            else ->
                ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(mapOf("error" to "Unexpected"))
        }
    }

    @DeleteMapping("/api/admin/portfolios/{portfolioId}")
    fun delete(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val g = adminGate(request)
        if (g is AdminGate.Err) {
            return g.response
        }
        g as AdminGate.Ok
        val ok = adminPortfoliosService.deletePortfolio(g.session, portfolioId)
        if (!ok) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Portfolio not found"))
        }
        return ResponseEntity.ok(mapOf("ok" to true))
    }

    private fun errResponse(
        status: Int,
        error: String,
        details: Map<String, Any?>,
    ): ResponseEntity<Map<String, Any?>> {
        val body = mutableMapOf<String, Any?>("error" to error)
        if (details.isNotEmpty()) {
            body["details"] = details
        }
        return ResponseEntity.status(status).body(body.toMap())
    }

    private sealed class AdminGate {
        data class Ok(val session: com.atxfinance.backend.session.ResolvedSession) : AdminGate()
        data class Err(val response: ResponseEntity<Map<String, Any?>>) : AdminGate()
    }

    private fun adminGate(request: HttpServletRequest): AdminGate {
        val session =
            sessionCookieParser.resolveSessionUser(
                request.getHeader("Cookie"),
                props.sessionCookieName,
            ) ?: return AdminGate.Err(
                ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized")),
            )
        if (!session.isGlobalAdmin()) {
            return AdminGate.Err(
                ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden")),
            )
        }
        return AdminGate.Ok(session)
    }
}
