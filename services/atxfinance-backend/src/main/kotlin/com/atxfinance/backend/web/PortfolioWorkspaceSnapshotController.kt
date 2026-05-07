package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PortfolioWorkspaceSnapshotService
import com.atxfinance.backend.session.SessionCookieParser
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class PortfolioWorkspaceSnapshotController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val portfolioWorkspaceSnapshotService: PortfolioWorkspaceSnapshotService,
) {
    @GetMapping("/api/portfolios/{portfolioId}/workspace-snapshot")
    fun getWorkspaceSnapshot(
        request: HttpServletRequest,
        @PathVariable portfolioId: String,
        @RequestParam(name = "workspaceContentRev", defaultValue = "0") workspaceContentRev: Int,
    ): ResponseEntity<Map<String, Any?>> {
        val session =
            sessionCookieParser.resolveSessionUser(
                request.getHeader("Cookie"),
                props.sessionCookieName,
            ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))

        val data =
            portfolioWorkspaceSnapshotService.findSnapshotForSessionUser(
                portfolioId,
                workspaceContentRev,
                session,
            )
                ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "snapshot_not_found"))

        return ResponseEntity.ok(mapOf("data" to data))
    }
}
