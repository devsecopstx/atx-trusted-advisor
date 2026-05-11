package com.atxfinance.backend.xchat

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.stereotype.Service

@Service
class XchatUserPreferencesService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    fun shouldPersistHistory(session: ResolvedSession): Boolean {
        val filter =
            PortfolioMongoFilter.withTenantScopeCriteria(
                PortfolioMongoFilter.userIdCriteria(session.userId),
                session.tenantId,
            )
        val doc =
            mongoTemplate.findOne(
                Query.query(filter),
                Document::class.java,
                props.xchatUserPreferencesCollection,
            )
        return doc?.getBoolean("keepLastTenMessages") == true
    }
}
