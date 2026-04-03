package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.util.Date

@Service
class StrategyJobFinalizerCoordinator(
    private val props: AtxfinanceProperties,
    private val mongoTemplate: MongoTemplate,
    private val finalizer: StrategyJobFinalizerService,
    private val asyncRunner: StrategyJobFinalizerAsyncRunner,
) {

    /** Called when the last slot turn moves the job to `slots_complete`. */
    fun onSlotsComplete(session: ResolvedSession, jobId: String) {
        val sync = props.strategyFinalizerSyncForGlobalAdmin && session.roles.contains("global_admin")
        if (sync) {
            finalizer.runFinalize(session, jobId)
        } else {
            asyncRunner.enqueue(session, jobId)
        }
    }

    /**
     * Ensures a `slots_complete` job has `artifactStatus=pending` (legacy rows) then enqueues async finalize.
     * Safe to call on every artifact poll — duplicate enqueues no-op once `running`/`ready`.
     */
    /**
     * Legacy jobs may reach `slots_complete` without `artifactStatus`; set `pending` and kick the finalizer once.
     * Jobs created after finalizer shipped get `pending` + kick from [StrategyJobService.postTurn] — do not re-enqueue on every poll.
     */
    fun ensureFinalizeScheduled(session: ResolvedSession, jobId: String) {
        if (!ObjectId.isValid(jobId)) {
            return
        }
        val oid = ObjectId(jobId)
        val doc = mongoTemplate.findById(oid, Document::class.java, props.strategyJobsCollection) ?: return
        if (doc.getString("userId") != session.userId || doc.getString("tenantId") != session.tenantId) {
            return
        }
        if (doc.getString("status") != StrategyJobService.STATUS_SLOTS_COMPLETE) {
            return
        }
        val st = doc.getString("artifactStatus")?.trim()
        if (!st.isNullOrEmpty()) {
            return
        }
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(oid)),
            Update().set("artifactStatus", "pending").set("updatedAt", Date()),
            props.strategyJobsCollection,
        )
        if (props.strategyFinalizerSyncForGlobalAdmin && session.roles.contains("global_admin")) {
            finalizer.runFinalize(session, jobId)
        } else {
            asyncRunner.enqueue(session, jobId)
        }
    }
}
