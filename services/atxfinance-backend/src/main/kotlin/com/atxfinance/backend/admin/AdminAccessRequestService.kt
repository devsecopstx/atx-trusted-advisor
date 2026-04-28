package com.atxfinance.backend.admin

import com.atxfinance.backend.audit.AuditEventService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.identity.CoreUserService
import com.atxfinance.backend.identity.CredentialInviteService
import com.atxfinance.backend.portfolio.BsonJson
import com.atxfinance.backend.portfolio.DefaultPortfolioProvisionService
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import java.util.Date

@Service
class AdminAccessRequestService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val coreUserService: CoreUserService,
    private val auditEventService: AuditEventService,
    private val defaultPortfolioProvisionService: DefaultPortfolioProvisionService,
    private val credentialInviteService: CredentialInviteService,
) {
    private val actionableStatuses = setOf("new", "triaged", "pending")
    private val allStatuses = setOf("new", "triaged", "pending", "approved", "rejected", "expired")
    private val grantableRoles = setOf("global_admin", "advisor", "operator", "viewer")
    private val canonicalPlans = setOf("basic", "premium", "premium_plus")

    /** Maps legacy JVM/UI slugs to Mongo / Next canonical `subscriptionPlan` values. */
    private fun canonicalSubscriptionPlan(raw: String?): String {
        val n = raw?.trim()?.lowercase() ?: return "basic"
        val mapped = when (n) {
            "free" -> "basic"
            "pro", "premium_monthly" -> "premium"
            "enterprise", "premium+", "premium_plus_monthly", "premium_plus_yearly" -> "premium_plus"
            else -> n
        }
        return if (mapped in canonicalPlans) mapped else "basic"
    }

    fun list(statusFilter: String): List<Map<String, Any?>> {
        val lim = 50
        val crit = when (statusFilter) {
            "all" -> Criteria()
            "open" -> Criteria.where("status").`in`(listOf("new", "triaged", "pending"))
            else -> {
                if (statusFilter !in allStatuses) {
                    throw IllegalArgumentException("Invalid status")
                }
                Criteria.where("status").`is`(statusFilter)
            }
        }
        val q = Query.query(crit).with(Sort.by(Sort.Direction.DESC, "requestedAt")).limit(lim)
        val requests = mongoTemplate.find(q, Document::class.java, props.accessRequestsCollection)
        if (requests.isEmpty()) {
            return emptyList()
        }
        val userIds = requests.flatMap { listOfNotNull(it.getString("userId"), it.getString("reviewedBy")) }
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .distinct()
        val usersById = coreUserService.loadUsersForSummaries(userIds)
        val entityIds = requests.mapNotNull { it.getObjectId("_id")?.toHexString() }
        val latestAudit = loadLatestAuditByEntityIds(entityIds)
        return requests.map { doc ->
            val base = documentToAccessRequestMap(doc)
            val uid = doc.getString("userId")?.trim()
            val rid = doc.getString("reviewedBy")?.trim()
            val withUsers = base.toMutableMap()
            if (uid != null) {
                usersById[uid]?.let { withUsers["user"] = coreUserService.toUserSummary(it) }
            }
            if (rid != null) {
                usersById[rid]?.let { withUsers["reviewedByUser"] = coreUserService.toUserSummary(it) }
            }
            val eid = doc.getObjectId("_id")?.toHexString()
            withUsers["latestAuditEvent"] = eid?.let { id -> latestAudit[id]?.let { serializeAuditEvent(it) } }
            withUsers
        }
    }

    fun getById(id: String): Pair<Document, List<Map<String, Any?>>>? {
        if (!ObjectId.isValid(id)) {
            return null
        }
        val doc = mongoTemplate.findById(ObjectId(id), Document::class.java, props.accessRequestsCollection)
            ?: return null
        val trail = loadAuditTrailForEntity(id)
        return doc to trail
    }

    fun createAdmin(
        session: ResolvedSession,
        userIdInput: String?,
        emailInput: String?,
        requestedRole: String,
        reason: String,
        requestedPlan: String,
        statusInput: String?,
    ): Pair<Document, Map<String, Any?>> {
        if (requestedRole !in grantableRoles) {
            throw IllegalArgumentException("Invalid requestedRole")
        }
        if (reason.length < 5) {
            throw IllegalArgumentException("reason length")
        }
        val hasUid = !userIdInput.isNullOrBlank()
        val hasEmail = !emailInput.isNullOrBlank()
        if (!hasUid && !hasEmail) {
            throw IllegalArgumentException("Provide either userId or email")
        }
        if (hasUid && hasEmail) {
            throw IllegalArgumentException("Provide only one identifier")
        }
        var resolvedUserId: String? = null
        var resolvedEmail: String? = null
        if (hasEmail) {
            val u = coreUserService.ensureByEmail(emailInput!!)
            resolvedUserId = u.getObjectId("_id")?.toHexString()
            resolvedEmail = u.getString("email")
        } else {
            resolvedUserId = userIdInput!!.trim()
        }
        val uid = resolvedUserId ?: throw IllegalStateException("Unable to resolve user id")
        val pending = findPendingGlobal(uid, requestedRole)
        if (pending != null) {
            throw AccessRequestConflictException(documentToAccessRequestMap(pending))
        }
        val now = Date()
        val doc = Document()
        doc["userId"] = uid
        doc["requestedRole"] = requestedRole
        doc["requestedPlan"] = requestedPlan
        doc["reason"] = reason
        doc["requestedAt"] = now
        val st = if (hasEmail) {
            "pending"
        } else {
            statusInput?.takeIf { it in allStatuses } ?: "pending"
        }
        doc["status"] = st
        PortfolioMongoFilter.tenantObjectId(session.tenantId)?.let { doc["tenantId"] = it }
        if (resolvedEmail != null) {
            doc["contactEmail"] = resolvedEmail
        }
        mongoTemplate.insert(doc, props.accessRequestsCollection)
        val id = doc.getObjectId("_id")?.toHexString()
        if (id != null) {
            auditEventService.insertEvent(
                entityType = "access_request",
                entityId = id,
                action = "created",
                session = session,
                details = mapOf(
                    "requestedRole" to requestedRole,
                    "requestedPlan" to requestedPlan,
                    "reason" to reason,
                ),
            )
        }
        val meta = buildMap {
            put("resolvedUserId", uid)
            resolvedEmail?.let { put("resolvedEmail", it) }
        }
        return doc to meta
    }

    sealed class ReviewResult {
        data class Ok(val data: Map<String, Any?>) : ReviewResult()
        data class PlanOnly(val data: Map<String, Any?>) : ReviewResult()
        data class Error(val status: HttpStatus, val body: Map<String, Any?>) : ReviewResult()
    }

    fun reviewOrUpdatePlan(
        session: ResolvedSession,
        requestId: String,
        requestedPlan: String?,
        status: String?,
    ): ReviewResult {
        if (!ObjectId.isValid(requestId)) {
            return ReviewResult.Error(
                HttpStatus.BAD_REQUEST,
                mapOf("error" to "Invalid id"),
            )
        }
        val existing = mongoTemplate.findById(ObjectId(requestId), Document::class.java, props.accessRequestsCollection)
            ?: return ReviewResult.Error(HttpStatus.NOT_FOUND, mapOf("error" to "Access request not found"))
        val st = existing.getString("status") ?: ""
        if (st !in actionableStatuses) {
            return ReviewResult.Error(
                HttpStatus.CONFLICT,
                mapOf("error" to "Access request already reviewed", "data" to documentToAccessRequestMap(existing)),
            )
        }
        val planCanonOrNull = requestedPlan?.let { canonicalSubscriptionPlan(it) }
        if (planCanonOrNull != null) {
            mongoTemplate.updateFirst(
                Query.query(
                    Criteria().andOperator(
                        Criteria.where("_id").`is`(ObjectId(requestId)),
                        Criteria.where("status").`in`(actionableStatuses.toList()),
                    ),
                ),
                Update().set("requestedPlan", planCanonOrNull),
                props.accessRequestsCollection,
            )
        }
        if (requestedPlan != null && status == null) {
            val updated = mongoTemplate.findById(ObjectId(requestId), Document::class.java, props.accessRequestsCollection)
                ?: return ReviewResult.Error(HttpStatus.NOT_FOUND, mapOf("error" to "Access request not found"))
            auditEventService.insertEvent(
                entityType = "access_request",
                entityId = requestId,
                action = "updated_plan",
                session = session,
                details = mapOf("requestedPlan" to planCanonOrNull!!),
            )
            return ReviewResult.PlanOnly(documentToAccessRequestMap(updated))
        }
        if (status == null) {
            return ReviewResult.Error(HttpStatus.BAD_REQUEST, mapOf("error" to "Missing review status"))
        }
        if (status !in setOf("approved", "rejected")) {
            return ReviewResult.Error(HttpStatus.BAD_REQUEST, mapOf("error" to "Invalid status"))
        }
        val refreshed = mongoTemplate.findById(ObjectId(requestId), Document::class.java, props.accessRequestsCollection)!!
        val effectivePlan = canonicalSubscriptionPlan(requestedPlan ?: refreshed.getString("requestedPlan"))
        val targetUserId = refreshed.getString("userId")?.trim() ?: ""
        if (status == "approved") {
            if (!ObjectId.isValid(targetUserId)) {
                return ReviewResult.Error(
                    HttpStatus.BAD_REQUEST,
                    mapOf("error" to "Approved request has invalid user id"),
                )
            }
            val roleToGrant = refreshed.getString("requestedRole")?.trim()?.lowercase() ?: ""
            if (roleToGrant !in grantableRoles) {
                return ReviewResult.Error(
                    HttpStatus.BAD_REQUEST,
                    mapOf("error" to "Invalid requestedRole on access request"),
                )
            }
            val oid = ObjectId(targetUserId)
            coreUserService.addRole(oid, roleToGrant)
            coreUserService.setSubscriptionPlan(oid, effectivePlan)
            try {
                // Default book: portfolio + paper account ($25k) + TSLA watchlist (DefaultPortfolioProvisionService)
                defaultPortfolioProvisionService.provisionForAccessRequestApprovedUser(targetUserId)
            } catch (e: Exception) {
                return ReviewResult.Error(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    mapOf(
                        "error" to "Failed to provision default portfolio resources",
                        "details" to (e.message ?: "Unknown error"),
                    ),
                )
            }
        }
        val reviewedAt = Date()
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(ObjectId(requestId))),
            Update()
                .set("status", status)
                .set("reviewedBy", session.userId)
                .set("reviewedAt", reviewedAt),
            props.accessRequestsCollection,
        )
        val reviewed = mongoTemplate.findById(ObjectId(requestId), Document::class.java, props.accessRequestsCollection)
            ?: return ReviewResult.Error(HttpStatus.NOT_FOUND, mapOf("error" to "Access request not found"))
        auditEventService.insertEvent(
            entityType = "access_request",
            entityId = requestId,
            action = if (status == "approved") "approved" else "rejected",
            session = session,
            details = mapOf("requestedPlan" to effectivePlan),
        )
        if (status == "approved") {
            val u = coreUserService.getById(targetUserId)
            val email = u?.getString("email")
            if (email.isNullOrBlank()) {
                auditEventService.insertEvent(
                    entityType = "access_request",
                    entityId = requestId,
                    action = "alert-user-not-sync-warning",
                    session = session,
                    details = mapOf(
                        "reason" to "approved user email missing; skipped xchat bootstrap sync",
                        "userId" to targetUserId,
                    ),
                )
            } else {
                auditEventService.insertEvent(
                    entityType = "access_request",
                    entityId = requestId,
                    action = "bootstrap_deferred",
                    session = session,
                    details = mapOf(
                        "note" to "Full xAI/bootstrap pipeline runs on Next core app; portfolio and roles applied in JVM.",
                        "userEmail" to email,
                    ),
                )
                credentialInviteService.maybeIssueInviteAndSendEmail(ObjectId(targetUserId), email)
            }
        }
        return ReviewResult.Ok(documentToAccessRequestMap(reviewed))
    }

    fun deleteById(session: ResolvedSession, requestId: String): Boolean {
        if (!ObjectId.isValid(requestId)) {
            return false
        }
        val res = mongoTemplate.remove(
            Query.query(Criteria.where("_id").`is`(ObjectId(requestId))),
            props.accessRequestsCollection,
        )
        val ok = res.deletedCount == 1L
        if (ok) {
            auditEventService.insertEvent(
                entityType = "access_request",
                entityId = requestId,
                action = "deleted",
                session = session,
            )
        }
        return ok
    }

    private fun findPendingGlobal(userId: String, requestedRole: String): Document? {
        val q = Query.query(
            Criteria().andOperator(
                PortfolioMongoFilter.userIdCriteria(userId),
                Criteria.where("requestedRole").`is`(requestedRole),
                Criteria.where("status").`in`(actionableStatuses.toList()),
            ),
        )
        return mongoTemplate.findOne(q, Document::class.java, props.accessRequestsCollection)
    }

    private fun loadLatestAuditByEntityIds(entityIds: List<String>): Map<String, Document> {
        if (entityIds.isEmpty()) {
            return emptyMap()
        }
        val q = Query.query(
            Criteria().andOperator(
                Criteria.where("entityType").`is`("access_request"),
                Criteria.where("entityId").`in`(entityIds),
            ),
        ).with(Sort.by(Sort.Direction.DESC, "createdAt"))
        val all = mongoTemplate.find(q, Document::class.java, props.auditEventsCollection)
        val out = linkedMapOf<String, Document>()
        for (e in all) {
            val eid = e.getString("entityId") ?: continue
            if (!out.containsKey(eid)) {
                out[eid] = e
            }
        }
        return out
    }

    private fun loadAuditTrailForEntity(entityId: String): List<Map<String, Any?>> {
        val q = Query.query(
            Criteria().andOperator(
                Criteria.where("entityType").`is`("access_request"),
                Criteria.where("entityId").`is`(entityId),
            ),
        ).with(Sort.by(Sort.Direction.DESC, "createdAt"))
        return mongoTemplate.find(q, Document::class.java, props.auditEventsCollection).map { serializeAuditEvent(it) }
    }

    private fun serializeAuditEvent(doc: Document): Map<String, Any?> {
        val actor = doc["actor"] as? Document
        return mapOf(
            "action" to doc.getString("action"),
            "createdAt" to (doc.getDate("createdAt")?.toInstant()?.toString() ?: ""),
            "actor" to (actor?.let { BsonJson.documentToMap(it) }),
            "details" to (doc["details"]?.let { BsonJson.value(it) }),
        )
    }

    private fun documentToAccessRequestMap(doc: Document): Map<String, Any?> {
        val m = BsonJson.documentToMap(doc).toMutableMap()
        m["_id"] = doc.getObjectId("_id")?.toHexString()
        m["tenantId"] = doc["tenantId"]?.let { BsonJson.value(it) }
        m["requestedAt"] = doc.getDate("requestedAt")?.toInstant()?.toString()
        m["reviewedAt"] = doc.getDate("reviewedAt")?.toInstant()?.toString()
        return m
    }

    class AccessRequestConflictException(val data: Map<String, Any?>) : RuntimeException("pending exists")
}
