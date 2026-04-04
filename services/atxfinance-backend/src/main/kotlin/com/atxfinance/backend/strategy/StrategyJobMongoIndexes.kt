package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import jakarta.annotation.PostConstruct
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.index.Index
import org.springframework.data.mongodb.core.index.PartialIndexFilter
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.stereotype.Component
import java.util.concurrent.TimeUnit

/**
 * Ensures compound + partial indexes match [StrategyJobService] query patterns (list, count, idempotency).
 * Optional TTL on [expiresAt] when [AtxfinanceProperties.strategyJobsTtlDays] &gt; 0.
 */
@Component
class StrategyJobMongoIndexes(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @PostConstruct
    fun ensureIndexes() {
        val coll = props.strategyJobsCollection
        val ops = mongoTemplate.indexOps(coll)
        try {
            ops.ensureIndex(
                Index()
                    .on("tenantId", Sort.Direction.ASC)
                    .on("userId", Sort.Direction.ASC)
                    .on("emailAccountId", Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.DESC)
                    .named("idx_strategy_jobs_scope_created_desc"),
            )
            /** Status-filtered lists / ops (prefix still supports tenant+user+email equality without `status`). */
            ops.ensureIndex(
                Index()
                    .on("tenantId", Sort.Direction.ASC)
                    .on("userId", Sort.Direction.ASC)
                    .on("emailAccountId", Sort.Direction.ASC)
                    .on("status", Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.DESC)
                    .named("idx_strategy_jobs_scope_status_created_desc"),
            )
            ops.ensureIndex(
                Index()
                    .on("tenantId", Sort.Direction.ASC)
                    .on("userId", Sort.Direction.ASC)
                    .on("emailAccountId", Sort.Direction.ASC)
                    .on("idempotencyKey", Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.DESC)
                    .partial(PartialIndexFilter.of(Criteria.where("idempotencyKey").exists(true)))
                    .named("idx_strategy_jobs_idempotency_partial"),
            )
            if (props.strategyJobsTtlDays > 0) {
                ops.ensureIndex(
                    Index()
                        .on("expiresAt", Sort.Direction.ASC)
                        .expire(0, TimeUnit.SECONDS)
                        .named("ttl_strategy_jobs_expires_at"),
                )
            }
            log.info("[strategy_jobs] Mongo indexes ensured on collection {}", coll)
        } catch (e: Exception) {
            log.warn("[strategy_jobs] ensureIndexes failed (non-fatal): {}", e.message)
        }
    }
}
