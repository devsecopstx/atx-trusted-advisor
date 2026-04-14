package com.atxfinance.backend.config

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ClientHttpMetricsConventionConfigTest {

    @Test
    fun `templates xAI management collection document link`() {
        val path = "/v1/collections/col_abc123/documents/file_xyz789"
        assertEquals(
            "/v1/collections/{collectionId}/documents/{fileId}",
            templateOutboundPath("management-api.x.ai", path),
        )
    }

    @Test
    fun `templates xAI api file get`() {
        assertEquals(
            "/v1/files/{fileId}",
            templateOutboundPath("api.x.ai", "/v1/files/abc-123-long-id-value"),
        )
    }

    @Test
    fun `leaves fixed OAuth paths on x com`() {
        assertEquals(
            "/2/oauth2/token",
            templateOutboundPath("api.x.com", "/2/oauth2/token"),
        )
    }

    @Test
    fun `collapses mongo object id segments for unknown hosts`() {
        assertEquals(
            "/api/widgets/{id}/sub",
            templateOutboundPath("example.com", "/api/widgets/507f1f77bcf86cd799439011/sub"),
        )
    }
}
