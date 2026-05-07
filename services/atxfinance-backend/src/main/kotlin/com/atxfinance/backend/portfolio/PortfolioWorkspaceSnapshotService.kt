package com.atxfinance.backend.portfolio

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.stereotype.Service
import java.time.Instant

@Service
class PortfolioWorkspaceSnapshotService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val portfolioCrudService: PortfolioCrudService,
) {
    /**
     * Returns materialized xChat workspace preload for an **owned** portfolio + rev, or null if missing.
     */
    fun findSnapshotForSessionUser(
        portfolioIdHex: String,
        workspaceContentRev: Int,
        session: ResolvedSession,
    ): Map<String, Any?>? {
        if (workspaceContentRev < 0 || !ObjectId.isValid(portfolioIdHex)) {
            return null
        }
        portfolioCrudService.findPortfolioForSessionUser(portfolioIdHex, session) ?: return null
        val doc =
            mongoTemplate.findOne(
                Query.query(
                    Criteria.where("portfolioId").`is`(ObjectId(portfolioIdHex))
                        .and("workspaceContentRev").`is`(workspaceContentRev),
                ),
                Document::class.java,
                props.portfolioWorkspaceSnapshotsCollection,
            ) ?: return null
        val preload = doc["preload"] ?: return null
        val mat = doc.getDate("materializedAt")
        val matIso = mat?.let { Instant.ofEpochMilli(it.time).toString() }
        return mapOf(
            "preload" to preload,
            "workspaceContentRev" to workspaceContentRev,
            "materializedAt" to matIso,
            "source" to (doc.getString("source") ?: ""),
        )
    }
}
