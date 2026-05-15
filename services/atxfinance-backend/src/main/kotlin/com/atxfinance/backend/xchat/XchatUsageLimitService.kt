package com.atxfinance.backend.xchat

import com.atxfinance.backend.config.AtxfinanceProperties
import com.mongodb.client.model.IndexOptions
import com.mongodb.client.model.Indexes
import jakarta.annotation.PostConstruct
import org.bson.Document
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.concurrent.atomic.AtomicBoolean

typealias XchatUsageLimitCode =
    String // xchat_rate_limit_exceeded | xchat_hourly_limit_exceeded | xchat_daily_limit_exceeded

data class XchatUsageLimitResult(
    val allowed: Boolean,
    val code: XchatUsageLimitCode? = null,
    val retryAfterSeconds: Int? = null,
    val remainingMinute: Int? = null,
    val remainingHour: Int? = null,
    val remainingDay: Int? = null,
    val hourlyLimit: Int? = null,
    val dailyLimit: Int? = null,
    val observedMinuteCount: Int? = null,
    val observedHourCount: Int? = null,
    val observedDayCount: Int? = null,
    val effectiveDailyLimit: Int? = null,
    val effectiveHourlyLimit: Int? = null,
)

@Service
class XchatUsageLimitService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    private val indexesEnsured = AtomicBoolean(false)

    @PostConstruct
    fun ensureIndexesOnStartup() {
        ensureUsageIndexes()
    }

    fun enforceDistributedAskUsageLimit(input: XchatUsageLimitInput): XchatUsageLimitResult {
        ensureUsageIndexes()
        val now = Instant.now()
        val minuteBucket =
            incrementUsageBucket(
                kind = "minute",
                userId = input.userId,
                tenantId = input.tenantId,
                now = now,
            )
        val perMinuteCap = input.perMinuteLimit.coerceAtLeast(0)
        if (perMinuteCap > 0 && minuteBucket.count > perMinuteCap) {
            val minuteWindowEndMs = minuteBucket.bucketStart.toEpochMilli() + ONE_MINUTE_MS
            return XchatUsageLimitResult(
                allowed = false,
                code = "xchat_rate_limit_exceeded",
                retryAfterSeconds = ((minuteWindowEndMs - now.toEpochMilli()) / 1000.0).toInt().coerceAtLeast(1),
                remainingMinute = 0,
                observedMinuteCount = minuteBucket.count,
            )
        }
        val remainingMinute =
            if (perMinuteCap > 0) {
                (perMinuteCap - minuteBucket.count).coerceAtLeast(0)
            } else {
                null
            }
        if (!input.enforceDailyLimit) {
            val hourBucket =
                incrementUsageBucket(
                    kind = "hour",
                    userId = input.userId,
                    tenantId = input.tenantId,
                    now = now,
                )
            val dayBucket =
                incrementUsageBucket(
                    kind = "day",
                    userId = input.userId,
                    tenantId = input.tenantId,
                    now = now,
                )
            return XchatUsageLimitResult(
                allowed = true,
                remainingMinute = remainingMinute,
                observedMinuteCount = minuteBucket.count,
                observedHourCount = hourBucket.count,
                observedDayCount = dayBucket.count,
            )
        }
        val hourlyCap = input.hourlyPromptLimit?.takeIf { it > 0 }?.coerceAtLeast(1) ?: 0
        val dailyLimit =
            input.dailyPromptLimit?.takeIf { it > 0 }?.coerceAtLeast(1)
                ?: XchatPlanLimits.maxPromptsPerDay(input.subscriptionPlan)
        val hourBucket =
            incrementUsageBucket(
                kind = "hour",
                userId = input.userId,
                tenantId = input.tenantId,
                now = now,
            )
        var remainingHour: Int? = null
        if (hourlyCap > 0) {
            if (hourBucket.count > hourlyCap) {
                val hourEndMs = hourBucket.bucketStart.toEpochMilli() + ONE_HOUR_MS
                return XchatUsageLimitResult(
                    allowed = false,
                    code = "xchat_hourly_limit_exceeded",
                    retryAfterSeconds = ((hourEndMs - now.toEpochMilli()) / 1000.0).toInt().coerceAtLeast(1),
                    remainingMinute = remainingMinute,
                    remainingHour = 0,
                    hourlyLimit = hourlyCap,
                    observedMinuteCount = minuteBucket.count,
                    observedHourCount = hourBucket.count,
                    effectiveDailyLimit = dailyLimit,
                    effectiveHourlyLimit = hourlyCap,
                )
            }
            remainingHour = (hourlyCap - hourBucket.count).coerceAtLeast(0)
        }
        val dayBucket =
            incrementUsageBucket(
                kind = "day",
                userId = input.userId,
                tenantId = input.tenantId,
                now = now,
            )
        if (dayBucket.count > dailyLimit) {
            val nextDayStartMs = dayBucket.bucketStart.toEpochMilli() + ONE_DAY_MS
            return XchatUsageLimitResult(
                allowed = false,
                code = "xchat_daily_limit_exceeded",
                retryAfterSeconds = ((nextDayStartMs - now.toEpochMilli()) / 1000.0).toInt().coerceAtLeast(1),
                remainingMinute = remainingMinute,
                remainingHour = remainingHour,
                hourlyLimit = hourlyCap.takeIf { it > 0 },
                remainingDay = 0,
                dailyLimit = dailyLimit,
                observedMinuteCount = minuteBucket.count,
                observedHourCount = hourBucket.count,
                observedDayCount = dayBucket.count,
                effectiveDailyLimit = dailyLimit,
                effectiveHourlyLimit = hourlyCap.takeIf { it > 0 },
            )
        }
        return XchatUsageLimitResult(
            allowed = true,
            remainingMinute = remainingMinute,
            remainingHour = remainingHour,
            hourlyLimit = hourlyCap.takeIf { it > 0 },
            remainingDay = (dailyLimit - dayBucket.count).coerceAtLeast(0),
            dailyLimit = dailyLimit,
            observedMinuteCount = minuteBucket.count,
            observedHourCount = hourBucket.count,
            observedDayCount = dayBucket.count,
            effectiveDailyLimit = dailyLimit,
            effectiveHourlyLimit = hourlyCap.takeIf { it > 0 },
        )
    }

    private fun ensureUsageIndexes() {
        if (!indexesEnsured.compareAndSet(false, true)) {
            return
        }
        val ops = mongoTemplate.getCollection(props.xchatUsageLimitsCollection)
        ops.createIndex(Indexes.ascending("key"), IndexOptions().unique(true).name("uniq_xchat_usage_key"))
        ops.createIndex(Indexes.ascending("expiresAt"), IndexOptions().expireAfter(0L, java.util.concurrent.TimeUnit.SECONDS).name("ttl_xchat_usage_expires_at"))
    }

    private data class UsageBucket(
        val bucketStart: Instant,
        val count: Int,
    )

    private fun incrementUsageBucket(
        kind: String,
        userId: String,
        tenantId: String?,
        now: Instant,
    ): UsageBucket {
        val bucketStart = getBucketStart(kind, now)
        val key = buildUsageKey(kind, userId, tenantId, bucketStart)
        val nowDate = Date.from(now)
        val query = Query.query(Criteria.where("key").`is`(key))
        val update =
            Update()
                .setOnInsert("key", key)
                .setOnInsert("kind", kind)
                .setOnInsert("userId", userId)
                .setOnInsert("tenantId", tenantId)
                .setOnInsert("bucketStart", Date.from(bucketStart))
                .setOnInsert("expiresAt", Date.from(computeBucketExpiry(kind, bucketStart)))
                .setOnInsert("createdAt", nowDate)
                .set("updatedAt", nowDate)
                .inc("count", 1)
        val updated =
            mongoTemplate.findAndModify(
                query,
                update,
                org.springframework.data.mongodb.core.FindAndModifyOptions.options().upsert(true).returnNew(true),
                Document::class.java,
                props.xchatUsageLimitsCollection,
            ) ?: error("Failed to update xchat usage bucket")
        val count = (updated.get("count") as? Number)?.toInt() ?: 1
        return UsageBucket(bucketStart = bucketStart, count = count)
    }

    private fun getBucketStart(kind: String, now: Instant): Instant {
        val epochMs = now.toEpochMilli()
        return when (kind) {
            "minute" -> Instant.ofEpochMilli((epochMs / ONE_MINUTE_MS) * ONE_MINUTE_MS)
            "hour" -> Instant.ofEpochMilli((epochMs / ONE_HOUR_MS) * ONE_HOUR_MS)
            else -> {
                val zdt = ZonedDateTime.ofInstant(now, ZoneOffset.UTC)
                zdt.toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant()
            }
        }
    }

    private fun computeBucketExpiry(kind: String, bucketStart: Instant): Instant {
        val startMs = bucketStart.toEpochMilli()
        return when (kind) {
            "minute" -> Instant.ofEpochMilli(startMs + 2 * ONE_DAY_MS)
            "hour" -> Instant.ofEpochMilli(startMs + 3 * ONE_DAY_MS)
            else -> Instant.ofEpochMilli(startMs + 35 * ONE_DAY_MS)
        }
    }

    private fun buildUsageKey(
        kind: String,
        userId: String,
        tenantId: String?,
        bucketStart: Instant,
    ): String {
        val tenantSegment = tenantId?.trim()?.takeIf { it.isNotEmpty() } ?: "tenant:none"
        return "$kind:$userId:$tenantSegment:${formatBucketStartForUsageKey(bucketStart)}"
    }

    /** Match Next.js `Date.toISOString()` (always includes `.SSS` before `Z`). */
    private fun formatBucketStartForUsageKey(bucketStart: Instant): String =
        USAGE_BUCKET_KEY_ISO.format(bucketStart)

    companion object {
        private const val ONE_MINUTE_MS = 60_000L
        private const val ONE_HOUR_MS = 3_600_000L
        private const val ONE_DAY_MS = 86_400_000L

        private val USAGE_BUCKET_KEY_ISO: DateTimeFormatter =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)
    }
}

data class XchatUsageLimitInput(
    val userId: String,
    val tenantId: String?,
    val subscriptionPlan: String?,
    val perMinuteLimit: Int,
    val enforceDailyLimit: Boolean,
    val dailyPromptLimit: Int?,
    val hourlyPromptLimit: Int?,
)
