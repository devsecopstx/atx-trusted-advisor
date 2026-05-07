package com.atxfinance.backend.scheduling

import com.atxfinance.backend.config.AtxfinanceProperties
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock
import org.slf4j.LoggerFactory
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Duration
import java.time.Instant
import java.util.Date

/**
 * Belt-and-suspenders cleanup for `portfolio_workspace_snapshots` when Next TTL index is off or lagging.
 * **ShedLock:** one replica runs the purge per interval.
 */
@Component
class PortfolioWorkspaceSnapshotPurgeJob(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(fixedRateString = "\${app.atxfinance.portfolio-workspace-snapshot-purge-interval-ms:21600000}")
    @SchedulerLock(
        name = "portfolioWorkspaceSnapshotPurge",
        lockAtMostFor = "PT30M",
        lockAtLeastFor = "PT10S",
    )
    fun purgeStaleSnapshots() {
        if (!props.portfolioWorkspaceSnapshotPurgeEnabled) {
            return
        }
        val days = props.portfolioWorkspaceSnapshotPurgeRetentionDays
        if (days <= 0) {
            return
        }
        val cutoff = Date.from(Instant.now().minus(Duration.ofDays(days.toLong())))
        val q = Query.query(Criteria.where("materializedAt").lt(cutoff))
        val res = mongoTemplate.remove(q, props.portfolioWorkspaceSnapshotsCollection)
        val deleted = res.deletedCount
        if (deleted > 0) {
            log.info(
                "[portfolio_workspace_snapshots] purge removed {} row(s) older than {} days",
                deleted,
                days,
            )
        }
    }
}
