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
        data class Error(val status: HttpStatus, val body: Map<String, Any?>) : ReviewResult()
    }

    private val subscriptionPlanAliases: Map<String, String> =
        mapOf(
            "basic" to "basic",
            "free" to "basic",
            "premium" to "premium",
            "pro" to "premium",
            "premium_monthly" to "premium",
            "premium_plus" to "premium_plus",
            "enterprise" to "premium_plus",
            "premium+" to "premium_plus",
            "premium_plus_monthly" to "premium_plus",
            "premium_plus_yearly" to "premium_plus",
        )

    private fun parseStrictRequestedPlan(raw: String): String? {
        val n = raw.trim().lowercase()
        return subscriptionPlanAliases[n]
    }

    private fun upsertDefaultTenantMembership(userId: ObjectId, tenantId: ObjectId) {
        val now = Date()
        mongoTemplate.upsert(
            Query.query(Criteria.where("userId").`is`(userId).and("tenantId").`is`(tenantId)),
            Update()
                .setOnInsert("createdAt", now)
                .set("role", "member")
                .set("isDefaultTenant", true)
                .set("updatedAt", now),
            props.coreTenantMembershipsCollection,
        )
    }

    /**
     * Composite PATCH/PUT for admin access requests — matches Next `handleUpdate` field order:
     * plan → tenant → role → optional approve/reject with tenant required on approve.
     * JVM does not yet mirror Next `assertTenantHasRoomForAnotherUser` / workspace membership caps — TODO parity.
     */
    fun applyCompositeUpdate(session: ResolvedSession, requestId: String, body: Map<String, Any?>): ReviewResult {
        if (!ObjectId.isValid(requestId)) {
            return ReviewResult.Error(HttpStatus.BAD_REQUEST, mapOf("error" to "Invalid id"))
        }
        val hasStatus = body.containsKey("status") && body["status"] != null
        val hasPlanKey = body.containsKey("requestedPlan")
        val hasRoleKey = body.containsKey("requestedRole")
        val hasTenantKey = body.containsKey("targetTenantId")
        if (!hasStatus && !hasPlanKey && !hasRoleKey && !hasTenantKey) {
            return ReviewResult.Error(HttpStatus.BAD_REQUEST, mapOf("error" to "Invalid request payload"))
        }

        val oid = ObjectId(requestId)
        val existing =
            mongoTemplate.findById(oid, Document::class.java, props.accessRequestsCollection)
                ?: return ReviewResult.Error(HttpStatus.NOT_FOUND, mapOf("error" to "Access request not found"))
        val st0 = existing.getString("status") ?: ""
        if (st0 !in actionableStatuses) {
            return ReviewResult.Error(
                HttpStatus.CONFLICT,
                mapOf("error" to "Access request already reviewed", "data" to documentToAccessRequestMap(existing)),
            )
        }

        if (hasPlanKey) {
            when (val raw = body["requestedPlan"]) {
                is String -> {
                    val parsed = parseStrictRequestedPlan(raw)
                    if (parsed == null) {
                        return ReviewResult.Error(
                            HttpStatus.BAD_REQUEST,
                            mapOf("error" to "Invalid requestedPlan. Expected Basic, Premium, or Premium+."),
                        )
                    }
                    mongoTemplate.updateFirst(
                        Query.query(
                            Criteria().andOperator(
                                Criteria.where("_id").`is`(oid),
                                Criteria.where("status").`in`(actionableStatuses.toList()),
                            ),
                        ),
                        Update().set("requestedPlan", parsed),
                        props.accessRequestsCollection,
                    )
                    auditEventService.insertEvent(
                        entityType = "access_request",
                        entityId = requestId,
                        action = "updated_plan",
                        session = session,
                        details = mapOf("requestedPlan" to parsed),
                    )
                }
                null -> Unit
                else ->
                    return ReviewResult.Error(HttpStatus.BAD_REQUEST, mapOf("error" to "Invalid request payload"))
            }
        }

        if (hasTenantKey) {
            when (val rawTenant = body["targetTenantId"]) {
                is String -> {
                    val tenantStr = rawTenant.trim()
                    val update =
                        if (tenantStr.isEmpty()) {
                            Update().unset("tenantId")
                        } else {
                            if (!ObjectId.isValid(tenantStr)) {
                                return ReviewResult.Error(HttpStatus.BAD_REQUEST, mapOf("error" to "Invalid targetTenantId"))
                            }
                            Update().set("tenantId", ObjectId(tenantStr))
                        }
                    mongoTemplate.updateFirst(
                        Query.query(
                            Criteria().andOperator(
                                Criteria.where("_id").`is`(oid),
                                Criteria.where("status").`in`(actionableStatuses.toList()),
                            ),
                        ),
                        update,
                        props.accessRequestsCollection,
                    )
                    auditEventService.insertEvent(
                        entityType = "access_request",
                        entityId = requestId,
                        action = "assigned_tenant",
                        session = session,
                        details = mapOf("targetTenantId" to tenantStr.ifEmpty { null }),
                    )
                }
                null -> {
                    mongoTemplate.updateFirst(
                        Query.query(
                            Criteria().andOperator(
                                Criteria.where("_id").`is`(oid),
                                Criteria.where("status").`in`(actionableStatuses.toList()),
                            ),
                        ),
                        Update().unset("tenantId"),
                        props.accessRequestsCollection,
                    )
                    auditEventService.insertEvent(
                        entityType = "access_request",
                        entityId = requestId,
                        action = "assigned_tenant",
                        session = session,
                        details = mapOf("targetTenantId" to null),
                    )
                }
                else ->
                    return ReviewResult.Error(HttpStatus.BAD_REQUEST, mapOf("error" to "Invalid targetTenantId"))
            }
        }

        if (hasRoleKey) {
            val roleRaw = body["requestedRole"]
            val rr =
                (roleRaw as? String)?.trim()?.lowercase()
                    ?: return ReviewResult.Error(HttpStatus.BAD_REQUEST, mapOf("error" to "Invalid request payload"))
            if (rr !in grantableRoles) {
                return ReviewResult.Error(HttpStatus.BAD_REQUEST, mapOf("error" to "Invalid request payload"))
            }
            mongoTemplate.updateFirst(
                Query.query(
                    Criteria().andOperator(
                        Criteria.where("_id").`is`(oid),
                        Criteria.where("status").`in`(actionableStatuses.toList()),
                    ),
                ),
                Update().set("requestedRole", rr),
                props.accessRequestsCollection,
            )
            auditEventService.insertEvent(
                entityType = "access_request",
                entityId = requestId,
                action = "updated_role",
                session = session,
                details = mapOf("requestedRole" to rr),
            )
        }

        val status = (body["status"] as? String)?.trim()?.lowercase()
        if (status == null) {
            val updated =
                mongoTemplate.findById(oid, Document::class.java, props.accessRequestsCollection)
                    ?: return ReviewResult.Error(HttpStatus.NOT_FOUND, mapOf("error" to "Access request not found"))
            return ReviewResult.Ok(documentToAccessRequestMap(updated))
        }

        if (status !in setOf("approved", "rejected")) {
            return ReviewResult.Error(HttpStatus.BAD_REQUEST, mapOf("error" to "Invalid request payload"))
        }

        val refreshed =
            mongoTemplate.findById(oid, Document::class.java, props.accessRequestsCollection)
                ?: return ReviewResult.Error(HttpStatus.NOT_FOUND, mapOf("error" to "Access request not found"))
        val requestedPlanRaw = body["requestedPlan"] as? String
        val effectivePlan = canonicalSubscriptionPlan(requestedPlanRaw ?: refreshed.getString("requestedPlan"))
        val targetUserId = refreshed.getString("userId")?.trim() ?: ""

        if (status == "rejected" && ObjectId.isValid(targetUserId)) {
            val u = coreUserService.getById(targetUserId)
            if ((u?.getString("accountStatus") ?: "") == "pending_approval") {
                mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").`is`(ObjectId(targetUserId))),
                    Update().set("accountStatus", "rejected").set("updatedAt", Date()),
                    props.coreUsersCollection,
                )
            }
        }

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
            val tenantOnRequest = refreshed["tenantId"]
            val tenantOid =
                when (tenantOnRequest) {
                    is ObjectId -> tenantOnRequest
                    else ->
                        return ReviewResult.Error(
                            HttpStatus.BAD_REQUEST,
                            mapOf(
                                "error" to
                                    "Target tenant is required before approval. Select a tenant (or send targetTenantId in this request), then approve.",
                                "code" to "access_request_tenant_required",
                            ),
                        )
                }
            val userOid = ObjectId(targetUserId)
            coreUserService.addRole(userOid, roleToGrant)
            coreUserService.setSubscriptionPlan(userOid, effectivePlan)
            upsertDefaultTenantMembership(userOid, tenantOid)
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(userOid)),
                Update().set("accountStatus", "approved").set("updatedAt", Date()),
                props.coreUsersCollection,
            )
            try {
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
        val update =
            Update()
                .set("status", status)
                .set("reviewedBy", session.userId)
                .set("reviewedAt", reviewedAt)
        if (body.containsKey("reviewNote")) {
            val note = body["reviewNote"]
            if (note is String) {
                update.set("reviewNote", note.trim().take(500))
            }
        }
        mongoTemplate.updateFirst(Query.query(Criteria.where("_id").`is`(oid)), update, props.accessRequestsCollection)
        val reviewed =
            mongoTemplate.findById(oid, Document::class.java, props.accessRequestsCollection)
                ?: return ReviewResult.Error(HttpStatus.NOT_FOUND, mapOf("error" to "Access request not found"))
        val details = mutableMapOf<String, Any?>("requestedPlan" to effectivePlan)
        if (body.containsKey("reviewNote") && body["reviewNote"] is String) {
            details["reviewNote"] = (body["reviewNote"] as String).trim().take(500)
        }
        auditEventService.insertEvent(
            entityType = "access_request",
            entityId = requestId,
            action = if (status == "approved") "approved" else "rejected",
            session = session,
            details = details,
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
