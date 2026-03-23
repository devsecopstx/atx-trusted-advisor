package com.atxfinance.backend.portfolio

import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.query.Criteria

/**
 * Mirrors `userIdQuery` / `withTenantScope` / `strictWriteTenantFilter` in
 * `src/modules/core-admin/repository.ts`.
 */
internal object PortfolioMongoFilter {

    fun userIdField(userId: String): Document =
        if (ObjectId.isValid(userId)) {
            Document("userId", Document("\$in", listOf(userId, ObjectId(userId))))
        } else {
            Document("userId", userId)
        }

    fun tenantObjectId(tenantId: String): ObjectId? =
        if (ObjectId.isValid(tenantId)) ObjectId(tenantId) else null

    fun withTenantScopeCriteria(base: Criteria, tenantId: String?): Criteria {
        val oid = tenantObjectId(tenantId ?: return base) ?: return base
        return Criteria().andOperator(base, Criteria.where("tenantId").`is`(oid))
    }

    fun strictWriteTenantCriteria(base: Criteria, tenantId: String?): Criteria {
        val oid = tenantObjectId(tenantId ?: return base) ?: return base
        return Criteria().andOperator(base, Criteria.where("tenantId").`is`(oid))
    }

    fun userIdCriteria(userId: String): Criteria =
        if (ObjectId.isValid(userId)) {
            Criteria.where("userId").`in`(listOf(userId, ObjectId(userId)))
        } else {
            Criteria.where("userId").`is`(userId)
        }

    /** Default portfolio lookup: tenant may be missing on legacy docs (TS `getDefaultPortfolio`). */
    fun defaultPortfolioFilter(session: ResolvedSession): Document {
        val uid = userIdField(session.userId)
        val isDefault = Document("isDefault", true)
        val tenantOid = tenantObjectId(session.tenantId)
        return if (tenantOid != null) {
            Document(
                "\$and",
                listOf(
                    uid,
                    isDefault,
                    Document(
                        "\$or",
                        listOf(
                            Document("tenantId", tenantOid),
                            Document("tenantId", null),
                            Document("tenantId", Document("\$exists", false)),
                        ),
                    ),
                ),
            )
        } else {
            Document("\$and", listOf(uid, isDefault))
        }
    }
}
