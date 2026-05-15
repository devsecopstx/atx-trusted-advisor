package com.atxfinance.backend.ratelimit

import com.atxfinance.backend.config.AtxfinanceProperties
import jakarta.annotation.PostConstruct
import org.bson.Document
import org.slf4j.LoggerFactory
import org.springframework.data.mongodb.core.FindAndModifyOptions
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.index.Index
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.util.Date
import java.util.concurrent.TimeUnit

/**
 * MongoDB atomic counters for distributed rate limits (same spirit as Next `xchat_usage_limits`:
 * deterministic `key`, upsert + `$inc` on `count`, TTL on `expiresAt`).
 *
 * Strategy job hourly creation uses [consumeStrategyJobHourlyCreate] + optional [rollbackStrategyJobHourlyCreate]
 * when the follow-up insert fails after a successful reservation.
 */
@Service
class RateLimitService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @PostConstruct
    fun ensureIndexes() {
        val coll = props.rateLimitsCollection
        val ops = mongoTemplate.indexOps(coll)
        try {
            ops.ensureIndex(Index().on("key", Sort.Direction.ASC).unique().named("uniq_rate_limits_key"))
            ops.ensureIndex(
                Index().on("expiresAt", Sort.Direction.ASC)
                    .expire(0, TimeUnit.SECONDS)
                    .named("ttl_rate_limits_expires_at"),
            )
            log.info("[rate_limits] Mongo indexes ensured on collection {}", coll)
        } catch (e: Exception) {
            log.warn("[rate_limits] ensureIndexes failed (non-fatal): {}", e.message)
        }
    }

    /**
     * Increments the UTC hour bucket for strategy job creation (tenant + user + email scope).
     * @return count after increment, or `null` when over [maxPerHour] (counter is not incremented past the cap —
     *         we compare after atomic `$inc` and treat `count > max` as denied, matching xChat hour semantics).
     */
    fun consumeStrategyJobHourlyCreate(
        tenantId: String,
        userId: String,
        normalizedEmailAccountScope: String,
        maxPerHour: Int,
    ): Int? {
        val now = Date()
        val bucketStart = hourBucketStartUtc(now)
        val key = buildStrategyJobHourlyKey(tenantId, userId, normalizedEmailAccountScope, bucketStart)
        val coll = props.rateLimitsCollection
        val up = Update()
            .setOnInsert("key", key)
            .setOnInsert("jobType", JOB_TYPE_STRATEGY_JOB_HOURLY)
            .setOnInsert("tenantId", tenantId.trim())
            .setOnInsert("userId", userId.trim())
            .setOnInsert("scope", normalizedEmailAccountScope)
            .setOnInsert("bucketStart", bucketStart)
            .setOnInsert("createdAt", now)
            .setOnInsert("expiresAt", Date(bucketStart.time + BUCKET_TTL_MS))
            .set("updatedAt", now)
            .inc("count", 1)
        val doc = mongoTemplate.findAndModify(
            Query.query(Criteria.where("key").`is`(key)),
            up,
            FindAndModifyOptions.options().upsert(true).returnNew(true),
            Document::class.java,
            coll,
        ) ?: return null
        val c = (doc["count"] as? Number)?.toInt() ?: 0
        return if (c > maxPerHour) {
            null
        } else {
            c
        }
    }

    fun rollbackStrategyJobHourlyCreate(
        tenantId: String,
        userId: String,
        normalizedEmailAccountScope: String,
    ) {
        val bucketStart = hourBucketStartUtc(Date())
        val key = buildStrategyJobHourlyKey(tenantId, userId, normalizedEmailAccountScope, bucketStart)
        val coll = props.rateLimitsCollection
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("key").`is`(key)),
            Update().inc("count", -1).set("updatedAt", Date()),
            coll,
        )
    }

    private fun hourBucketStartUtc(now: Date): Date {
        val t = now.time / HOUR_MS * HOUR_MS
        return Date(t)
    }

    private fun buildStrategyJobHourlyKey(
        tenantId: String,
        userId: String,
        scope: String,
        bucketStart: Date,
    ): String =
        "hour:$JOB_TYPE_STRATEGY_JOB_HOURLY:${tenantId.trim()}:${userId.trim()}:${scope.trim()}:${bucketStart.time}"

    companion object {
        const val JOB_TYPE_STRATEGY_JOB_HOURLY: String = "strategy_job_hourly"
        private const val HOUR_MS = 3_600_000L
        private const val BUCKET_TTL_MS = 48L * HOUR_MS
    }
}
