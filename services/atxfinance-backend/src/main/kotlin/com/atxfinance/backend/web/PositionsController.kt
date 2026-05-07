package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.BsonJson
import com.atxfinance.backend.portfolio.PortfolioSnapshotService
import com.atxfinance.backend.portfolio.PositionPayloadNormalizer
import com.atxfinance.backend.portfolio.PositionValidationException
import com.atxfinance.backend.portfolio.PositionsService
import com.atxfinance.backend.session.SessionCookieParser
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class PositionsController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val positionsService: PositionsService,
    private val portfolioSnapshotService: PortfolioSnapshotService,
) {

    @GetMapping("/api/positions")
    fun list(
        request: HttpServletRequest,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))

        val portfolioId = request.getParameter("portfolioId")?.trim().orEmpty()
        val accountId = request.getParameter("accountId")?.trim().orEmpty()
        if (portfolioId.isEmpty() || accountId.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("error" to "Query parameters portfolioId and accountId are required"),
            )
        }
        if (!positionsService.accountInPortfolio(session, portfolioId, accountId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Account not found"))
        }
        val rows = positionsService.listPositionsForPortfolioAccount(session, portfolioId, accountId)
        val data = rows.map { BsonJson.documentToMap(it) }
        return ResponseEntity.ok(mapOf("data" to data))
    }

    @PostMapping("/api/positions")
    fun create(
        request: HttpServletRequest,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))

        val map = body ?: emptyMap()
        val legacy = PositionPayloadNormalizer.parseLegacy(map)
        val normalized =
            when (legacy) {
                is PositionPayloadNormalizer.Normalized.Ok -> legacy.data
                is PositionPayloadNormalizer.Normalized.Err -> {
                    val open = PositionPayloadNormalizer.parseOpenApi(map)
                    when (open) {
                        is PositionPayloadNormalizer.Normalized.Ok -> open.data
                        is PositionPayloadNormalizer.Normalized.Err ->
                            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                                mapOf(
                                    "error" to "Invalid request payload",
                                    "details" to
                                        mapOf(
                                            "legacy" to legacy.message,
                                            "openapi" to open.message,
                                        ),
                                ),
                            )
                    }
                }
            }

        if (!positionsService.accountInPortfolio(session, normalized.portfolioId, normalized.accountId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Account not found"))
        }

        return try {
            val doc = positionsService.upsert(session, normalized)
            portfolioSnapshotService.invalidateWorkspaceSnapshotCache(session, normalized.portfolioId)
            ResponseEntity.status(HttpStatus.CREATED).body(mapOf("data" to BsonJson.documentToMap(doc)))
        } catch (e: PositionValidationException) {
            validationResponse(e)
        }
    }

    @DeleteMapping("/api/positions/{positionId}")
    fun delete(
        request: HttpServletRequest,
        @PathVariable positionId: String,
    ): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))

        val portfolioId = request.getParameter("portfolioId")?.trim().orEmpty()
        val accountId = request.getParameter("accountId")?.trim().orEmpty()
        if (portfolioId.isEmpty() || accountId.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("error" to "Query parameters portfolioId and accountId are required"),
            )
        }
        if (!positionsService.accountInPortfolio(session, portfolioId, accountId)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Account not found"))
        }
        val deleted = positionsService.delete(session, portfolioId, accountId, positionId)
        if (!deleted) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Position not found"))
        }
        portfolioSnapshotService.invalidateWorkspaceSnapshotCache(session, portfolioId)
        return ResponseEntity.ok(mapOf("ok" to true))
    }

    private fun validationResponse(e: PositionValidationException): ResponseEntity<Map<String, Any?>> {
        val status =
            when (e.code) {
                PositionValidationException.Code.ACCOUNT_NOT_FOUND,
                PositionValidationException.Code.ACCOUNT_PORTFOLIO_MISMATCH,
                -> HttpStatus.NOT_FOUND
                PositionValidationException.Code.INVALID_IDS,
                PositionValidationException.Code.ACCOUNT_MISSING_EXT_ACCOUNT_ID,
                PositionValidationException.Code.POSITION_FIELDS_INCOMPLETE,
                PositionValidationException.Code.INVALID_OPTION_EXPIRATION,
                -> HttpStatus.BAD_REQUEST
            }
        return ResponseEntity.status(status).body(
            mapOf(
                "error" to (e.message ?: ""),
                "code" to e.code.name,
            ),
        )
    }
}
