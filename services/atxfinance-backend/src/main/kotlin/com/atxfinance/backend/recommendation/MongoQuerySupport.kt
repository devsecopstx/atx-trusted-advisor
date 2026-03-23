package com.atxfinance.backend.recommendation

import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.query.Criteria

internal object MongoQuerySupport {

    fun userIdCriteria(userId: String): Criteria =
        if (ObjectId.isValid(userId)) {
            Criteria.where("userId").`in`(listOf(userId, ObjectId(userId)))
        } else {
            Criteria.where("userId").`is`(userId)
        }

    fun tenantObjectId(tenantId: String): ObjectId? =
        if (ObjectId.isValid(tenantId)) ObjectId(tenantId) else null

    /** Matches TS `withTenantScope` read semantics for legacy docs without tenant. */
    fun andWithTenantReadScope(base: Criteria, tenantId: String?): Criteria {
        val oid = tenantObjectId(tenantId ?: return base)
        val tenantOr = Criteria().orOperator(
            Criteria.where("tenantId").`is`(oid),
            Criteria.where("tenantId").exists(false),
            Criteria.where("tenantId").`is`(null),
        )
        return Criteria().andOperator(base, tenantOr)
    }
}
