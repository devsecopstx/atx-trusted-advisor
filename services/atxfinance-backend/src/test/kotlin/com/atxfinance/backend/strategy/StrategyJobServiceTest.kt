package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.ArgumentMatchers.eq
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.springframework.beans.factory.ObjectProvider
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update

class StrategyJobServiceTest {

    private val session = ResolvedSession(
        userId = ObjectId().toHexString(),
        tenantId = ObjectId().toHexString(),
        roles = listOf("viewer"),
        email = "u@example.com",
        username = null,
    )

    @Suppress("UNCHECKED_CAST")
    private fun quotaProvider(quota: StrategyJobRedisQuota?): ObjectProvider<StrategyJobRedisQuota> {
        val p = mock(ObjectProvider::class.java) as ObjectProvider<StrategyJobRedisQuota>
        `when`(p.ifAvailable).thenReturn(quota)
        return p
    }

    @Suppress("UNCHECKED_CAST")
    private fun finalizerProvider(coordinator: StrategyJobFinalizerCoordinator? = null): ObjectProvider<StrategyJobFinalizerCoordinator> {
        val p = mock(ObjectProvider::class.java) as ObjectProvider<StrategyJobFinalizerCoordinator>
        `when`(p.ifAvailable).thenReturn(coordinator)
        return p
    }

    private fun service(
        mongo: MongoTemplate,
        maxHourly: Int = 12,
        softWarn: Int = 8,
        quota: StrategyJobRedisQuota? = null,
    ): StrategyJobService {
        val props = AtxfinanceProperties(
            strategyJobsCollection = "strategy_jobs",
            strategyMaxJobsHourly = maxHourly,
            strategySoftWarnJobsHourly = softWarn,
        )
        return StrategyJobService(mongo, props, quotaProvider(quota), finalizerProvider())
    }

    @Test
    fun `createJob returns RateLimited when hourly count at cap`() {
        val mongo = mock(MongoTemplate::class.java)
        `when`(mongo.count(any(Query::class.java), eq("strategy_jobs"))).thenReturn(12L)
        val out = service(mongo).createJob(session, null, null)
        assertEquals(CreateJobOutcome.RateLimited, out)
    }

    @Test
    fun `createJob returns RateLimited when redis quota denies`() {
        val mongo = mock(MongoTemplate::class.java)
        val quota = mock(StrategyJobRedisQuota::class.java)
        `when`(quota.tryReserveSlot(session.tenantId, session.userId, "u@example.com")).thenReturn(null)
        val out = service(mongo, quota = quota).createJob(session, null, null)
        assertEquals(CreateJobOutcome.RateLimited, out)
    }

    @Test
    fun `createJob returns Idempotent when key matches recent row`() {
        val mongo = mock(MongoTemplate::class.java)
        `when`(mongo.count(any(Query::class.java), eq("strategy_jobs"))).thenReturn(0L)
        val existing = Document("_id", ObjectId())
        `when`(mongo.findOne(any(Query::class.java), eq(Document::class.java), eq("strategy_jobs")))
            .thenReturn(existing)
        val out = service(mongo).createJob(session, null, "idem-1")
        assertTrue(out is CreateJobOutcome.Idempotent)
        assertEquals(existing, (out as CreateJobOutcome.Idempotent).doc)
    }

    @Test
    fun `createJob inserts and returns Created with softWarn when near cap`() {
        val mongo = mock(MongoTemplate::class.java)
        `when`(mongo.count(any(Query::class.java), eq("strategy_jobs"))).thenReturn(8L)
        val out = service(mongo).createJob(session, null, null)
        assertTrue(out is CreateJobOutcome.Created)
        val c = out as CreateJobOutcome.Created
        assertTrue(c.softWarn)
        assertEquals(9, c.jobsInLastHourAfterCreate)
        verify(mongo).insert(any(Document::class.java), eq("strategy_jobs"))
    }

    @Test
    fun `postTurn advances from first choice slot to next`() {
        val mongo = mock(MongoTemplate::class.java)
        val id = ObjectId()
        val doc = Document()
        doc["_id"] = id
        doc["userId"] = session.userId
        doc["tenantId"] = session.tenantId
        doc["emailAccountId"] = "u@example.com"
        doc["correlationId"] = "corr"
        doc["status"] = StrategyJobService.STATUS_COLLECTING
        doc["slots"] = Document()
        doc["currentSlotKey"] = "outlook"
        doc["turns"] = emptyList<Document>()
        `when`(mongo.findById(id, Document::class.java, "strategy_jobs")).thenReturn(doc, doc)
        val out = service(mongo).postTurn(session, id.toHexString(), null, 2, null)
        assertTrue(out is PostTurnOutcome.Ok)
        verify(mongo).updateFirst(any(Query::class.java), any(Update::class.java), eq("strategy_jobs"))
    }

    @Test
    fun `postTurn returns NotFound when emailAccountId does not match job`() {
        val mongo = mock(MongoTemplate::class.java)
        val id = ObjectId()
        val doc = Document()
        doc["_id"] = id
        doc["userId"] = session.userId
        doc["tenantId"] = session.tenantId
        doc["emailAccountId"] = "desk-a"
        doc["correlationId"] = "corr"
        doc["status"] = StrategyJobService.STATUS_COLLECTING
        doc["slots"] = Document()
        doc["currentSlotKey"] = "outlook"
        doc["turns"] = emptyList<Document>()
        `when`(mongo.findById(id, Document::class.java, "strategy_jobs")).thenReturn(doc)
        val out = service(mongo).postTurn(session, id.toHexString(), null, 2, null)
        assertEquals(PostTurnOutcome.NotFound, out)
    }

    @Test
    fun `listJobs delegates to mongo find with expected collection`() {
        val mongo = mock(MongoTemplate::class.java)
        val d = Document("_id", ObjectId())
        `when`(mongo.find(any(Query::class.java), eq(Document::class.java), eq("strategy_jobs")))
            .thenReturn(listOf(d))
        val out = service(mongo).listJobs(session, null, 10)
        assertEquals(1, out.size)
        verify(mongo).find(any(Query::class.java), eq(Document::class.java), eq("strategy_jobs"))
    }
}
