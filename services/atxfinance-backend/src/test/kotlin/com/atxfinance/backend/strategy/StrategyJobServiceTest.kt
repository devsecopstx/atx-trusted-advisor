package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.ratelimit.RateLimitService
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any as mockitoAny
import org.mockito.ArgumentMatchers.anyInt
import org.mockito.ArgumentMatchers.anyString
import org.mockito.ArgumentMatchers.eq
import org.mockito.Mockito.`when`
import org.mockito.Mockito.doThrow
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
    private fun finalizerProvider(coordinator: StrategyJobFinalizerCoordinator? = null): ObjectProvider<StrategyJobFinalizerCoordinator> {
        val p = mock(ObjectProvider::class.java) as ObjectProvider<StrategyJobFinalizerCoordinator>
        `when`(p.ifAvailable).thenReturn(coordinator)
        return p
    }

    private fun service(
        mongo: MongoTemplate,
        rate: RateLimitService,
    ): StrategyJobService {
        val props = AtxfinanceProperties(
            strategyJobsCollection = "strategy_jobs",
            strategyMaxJobsHourly = 12,
            strategySoftWarnJobsHourly = 8,
        )
        return StrategyJobService(mongo, props, rate, finalizerProvider())
    }

    @Test
    fun `createJob returns RateLimited when mongo rate limit denies`() {
        val mongo = mock(MongoTemplate::class.java)
        val rate = mock(RateLimitService::class.java)
        `when`(
            rate.consumeStrategyJobHourlyCreate(anyString(), anyString(), anyString(), anyInt()),
        ).thenReturn(null)
        val out = service(mongo, rate).createJob(session, null, null)
        assertEquals(CreateJobOutcome.RateLimited, out)
    }

    @Test
    fun `createJob returns Idempotent when key matches recent row`() {
        val mongo = mock(MongoTemplate::class.java)
        val rate = mock(RateLimitService::class.java)
        val existing = Document("_id", ObjectId())
        `when`(mongo.findOne(mockitoAny(Query::class.java), eq(Document::class.java), eq("strategy_jobs")))
            .thenReturn(existing)
        val out = service(mongo, rate).createJob(session, null, "idem-1")
        assertTrue(out is CreateJobOutcome.Idempotent)
        assertEquals(existing, (out as CreateJobOutcome.Idempotent).doc)
    }

    @Test
    fun `createJob inserts and returns Created with softWarn when near cap`() {
        val mongo = mock(MongoTemplate::class.java)
        val rate = mock(RateLimitService::class.java)
        `when`(
            rate.consumeStrategyJobHourlyCreate(anyString(), anyString(), anyString(), anyInt()),
        ).thenReturn(9)
        val out = service(mongo, rate).createJob(session, null, null)
        assertTrue(out is CreateJobOutcome.Created)
        val c = out as CreateJobOutcome.Created
        assertTrue(c.softWarn)
        assertEquals(9, c.jobsInLastHourAfterCreate)
        verify(mongo).insert(mockitoAny(Document::class.java), eq("strategy_jobs"))
    }

    @Test
    fun `createJob rolls back rate counter when insert fails`() {
        val mongo = mock(MongoTemplate::class.java)
        val rate = mock(RateLimitService::class.java)
        `when`(
            rate.consumeStrategyJobHourlyCreate(anyString(), anyString(), anyString(), anyInt()),
        ).thenReturn(1)
        doThrow(RuntimeException("dup")).`when`(mongo).insert(
            mockitoAny(Document::class.java),
            eq("strategy_jobs"),
        )
        try {
            service(mongo, rate).createJob(session, null, null)
        } catch (_: RuntimeException) {
            // expected
        }
        verify(rate).rollbackStrategyJobHourlyCreate(session.tenantId, session.userId, "u@example.com")
    }

    @Test
    fun `postTurn advances from first choice slot to next`() {
        val mongo = mock(MongoTemplate::class.java)
        val rate = mock(RateLimitService::class.java)
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
        val out = service(mongo, rate).postTurn(session, id.toHexString(), null, 2, null)
        assertTrue(out is PostTurnOutcome.Ok)
        verify(mongo).updateFirst(mockitoAny(Query::class.java), mockitoAny(Update::class.java), eq("strategy_jobs"))
    }

    @Test
    fun `postTurn returns NotFound when emailAccountId does not match job`() {
        val mongo = mock(MongoTemplate::class.java)
        val rate = mock(RateLimitService::class.java)
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
        val out = service(mongo, rate).postTurn(session, id.toHexString(), null, 2, null)
        assertEquals(PostTurnOutcome.NotFound, out)
    }

    @Test
    fun `listJobs delegates to mongo find with expected collection`() {
        val mongo = mock(MongoTemplate::class.java)
        val rate = mock(RateLimitService::class.java)
        val d = Document("_id", ObjectId())
        `when`(mongo.find(mockitoAny(Query::class.java), eq(Document::class.java), eq("strategy_jobs")))
            .thenReturn(listOf(d))
        val out = service(mongo, rate).listJobs(session, null, 10)
        assertEquals(1, out.size)
        verify(mongo).find(mockitoAny(Query::class.java), eq(Document::class.java), eq("strategy_jobs"))
    }
}
