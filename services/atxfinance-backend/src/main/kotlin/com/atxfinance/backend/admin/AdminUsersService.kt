package com.atxfinance.backend.admin

import com.atxfinance.backend.audit.AuditEventService
import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.identity.CoreUserService
import com.atxfinance.backend.persona.PersonaService
import com.atxfinance.backend.portfolio.BsonJson
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.dao.DuplicateKeyException
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.util.Date

@Service
class AdminUsersService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val coreUserService: CoreUserService,
    private val auditEventService: AuditEventService,
    private val personaService: PersonaService,
) {
    fun listUsers(limit: Int): List<Map<String, Any?>> {
        val lim = limit.coerceIn(1, 500)
        val q = Query()
            .with(Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("createdAt")))
            .limit(lim)
        val users = mongoTemplate.find(q, Document::class.java, props.coreUsersCollection)
        val ids = users.mapNotNull { it.getObjectId("_id")?.toHexString() }
        val latestAudit = loadLatestAuditForCoreUserIds(ids)
        return users.map { doc ->
            val serialized = serializeCoreUser(doc).toMutableMap()
            val id = doc.getObjectId("_id")?.toHexString()
            val audit = id?.let { latestAudit[it] }?.let { serializeAuditEvent(it) }
            serialized.apply { this["latestAuditEvent"] = audit }
        }
    }

    fun createUser(
        session: ResolvedSession,
        email: String,
        role: String,
        subscriptionPlan: String,
        status: String,
    ): Map<String, Any?> {
        val now = Date()
        val doc = Document()
        doc["email"] = normalizeEmail(email)
        doc["roles"] = listOf(role)
        doc["subscriptionPlan"] = subscriptionPlan
        doc["status"] = status
        doc["createdAt"] = now
        doc["updatedAt"] = now
        val inserted = try {
            mongoTemplate.insert(doc, props.coreUsersCollection)
        } catch (_: DuplicateKeyException) {
            throw DuplicateEmailException()
        }
        val id = inserted.getObjectId("_id")
            ?: throw IllegalStateException("inserted user missing _id")
        if (ObjectId.isValid(session.tenantId) && role != "global_admin") {
            upsertTenantMembership(
                userId = id,
                tenantId = ObjectId(session.tenantId),
                role = "member",
                isDefaultTenant = false,
            )
        }
        auditEventService.insertEvent(
            entityType = "core_user",
            entityId = id.toHexString(),
            action = "created",
            session = session,
            details = mapOf(
                "role" to role,
                "subscriptionPlan" to subscriptionPlan,
                "status" to status,
            ),
        )
        return mapOf("data" to serializeCoreUser(inserted))
    }

    fun listApproved(session: ResolvedSession, limit: Int): List<Map<String, Any?>> {
        val lim = limit.coerceAtLeast(1)
        val fetchLimit = maxOf(lim * 3, lim)
        val base = Criteria.where("status").`is`("approved")
        val q = Query.query(PortfolioMongoFilter.withTenantScopeCriteria(base, session.tenantId.takeIf { it.isNotBlank() }))
            .with(Sort.by(Sort.Direction.DESC, "requestedAt"))
            .limit(fetchLimit)
        val requests = mongoTemplate.find(q, Document::class.java, props.accessRequestsCollection)
        val approvedByUserId = linkedMapOf<String, MutableMap<String, Any?>>()
        if (requests.isNotEmpty()) {
            val userIds = requests.mapNotNull { it.getString("userId")?.trim() }.filter { it.isNotEmpty() }.distinct()
            val usersById = coreUserService.loadUsersForSummaries(userIds)
            for (req in requests) {
                val uid = req.getString("userId")?.trim() ?: continue
                if (approvedByUserId.containsKey(uid)) continue
                val userDoc = usersById[uid]
                val roles = userDoc?.get("roles") as? List<*> ?: emptyList<Any>()
                val roleStr =
                    roles.map { it.toString() }.firstOrNull { it != "global_admin" }
                        ?: roles.firstOrNull()?.toString()
                        ?: "unknown"
                val name =
                    (userDoc?.get("xAccount") as? Document)?.getString("displayName")
                        ?: (userDoc?.get("xAccount") as? Document)?.getString("username")
                        ?: userDoc?.getString("email")
                        ?: uid
                val row = mutableMapOf<String, Any?>(
                    "userId" to uid,
                    "name" to name,
                    "email" to (userDoc?.getString("email") ?: ""),
                    "role" to roleStr,
                    "subscriptionPlan" to (userDoc?.getString("subscriptionPlan") ?: "free"),
                )
                req.getDate("reviewedAt")?.let { row["approvedAt"] = it.toInstant().toString() }
                approvedByUserId[uid] = row
            }
        }
        val tenantOid = PortfolioMongoFilter.tenantObjectId(session.tenantId)
        if (tenantOid != null) {
            val mems = mongoTemplate.find(
                Query.query(Criteria.where("tenantId").`is`(tenantOid)),
                Document::class.java,
                props.coreTenantMembershipsCollection,
            )
            val adminUserIds = mems.mapNotNull { it.getObjectId("userId")?.toHexString() }.distinct()
            if (adminUserIds.isNotEmpty()) {
                val oids = adminUserIds.filter { ObjectId.isValid(it) }.map { ObjectId(it) }
                val admins = mongoTemplate.find(
                    Query.query(
                        Criteria().andOperator(
                            Criteria.where("_id").`in`(oids),
                            Criteria.where("roles").`is`("global_admin"),
                        ),
                    ),
                    Document::class.java,
                    props.coreUsersCollection,
                )
                for (u in admins) {
                    val userId = u.getObjectId("_id")?.toHexString() ?: continue
                    if (approvedByUserId.containsKey(userId)) continue
                    val xa = u["xAccount"] as? Document
                    approvedByUserId[userId] = mutableMapOf(
                        "userId" to userId,
                        "name" to (xa?.getString("displayName") ?: xa?.getString("username") ?: u.getString("email")),
                        "email" to u.getString("email"),
                        "role" to "global_admin",
                        "subscriptionPlan" to (u.getString("subscriptionPlan") ?: "free"),
                    )
                }
            }
        }
        return approvedByUserId.values.take(lim)
    }

    fun getUser(userId: String): Map<String, Any?>? {
        if (!ObjectId.isValid(userId)) return null
        val doc = mongoTemplate.findById(ObjectId(userId), Document::class.java, props.coreUsersCollection)
            ?: return null
        val trail = loadAuditTrailForCoreUser(userId)
        val payload = serializeCoreUser(doc).toMutableMap()
        payload["auditTrail"] = trail
        return payload
    }

    fun updateUser(
        session: ResolvedSession,
        userId: String,
        email: String?,
        role: String?,
        subscriptionPlan: String?,
        status: String?,
    ): Map<String, Any?>? {
        if (!ObjectId.isValid(userId)) return null
        val oid = ObjectId(userId)
        val update = Update().set("updatedAt", Date())
        if (email != null) update.set("email", normalizeEmail(email))
        if (role != null) update.set("roles", listOf(role))
        if (subscriptionPlan != null) update.set("subscriptionPlan", subscriptionPlan)
        if (status != null) update.set("status", status)
        try {
            mongoTemplate.updateFirst(Query.query(Criteria.where("_id").`is`(oid)), update, props.coreUsersCollection)
        } catch (_: DuplicateKeyException) {
            throw DuplicateEmailException()
        }
        val updated = mongoTemplate.findById(oid, Document::class.java, props.coreUsersCollection) ?: return null
        auditEventService.insertEvent(
            entityType = "core_user",
            entityId = userId,
            action = "updated",
            session = session,
            details = mapOf(
                "changedFields" to listOfNotNull(
                    email?.let { "email" },
                    role?.let { "role" },
                    subscriptionPlan?.let { "subscriptionPlan" },
                    status?.let { "status" },
                ),
            ),
        )
        return serializeCoreUser(updated)
    }

    fun deleteUser(session: ResolvedSession, userId: String): Boolean {
        if (!ObjectId.isValid(userId)) return false
        val res = mongoTemplate.remove(
            Query.query(Criteria.where("_id").`is`(ObjectId(userId))),
            props.coreUsersCollection,
        )
        if (res.deletedCount != 1L) return false
        auditEventService.insertEvent(
            entityType = "core_user",
            entityId = userId,
            action = "deleted",
            session = session,
        )
        return true
    }

    fun patchRole(session: ResolvedSession, userId: String, role: String): Map<String, Any?>? {
        if (!ObjectId.isValid(userId)) return null
        val oid = ObjectId(userId)
        mongoTemplate.findById(oid, Document::class.java, props.coreUsersCollection) ?: return null
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(oid)),
            Update().set("roles", listOf(role)).set("updatedAt", Date()),
            props.coreUsersCollection,
        )
        val updated = mongoTemplate.findById(oid, Document::class.java, props.coreUsersCollection) ?: return null
        val r = (updated["roles"] as? List<*>)?.firstOrNull()?.toString() ?: "viewer"
        auditEventService.insertEvent(
            entityType = "core_user",
            entityId = userId,
            action = "updated_role",
            session = session,
            details = mapOf("role" to r),
        )
        return mapOf(
            "userId" to userId,
            "role" to r,
        )
    }

    fun patchPlan(session: ResolvedSession, userId: String, subscriptionPlan: String): Map<String, Any?>? {
        if (!ObjectId.isValid(userId)) return null
        val oid = ObjectId(userId)
        mongoTemplate.findById(oid, Document::class.java, props.coreUsersCollection) ?: return null
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(oid)),
            Update().set("subscriptionPlan", subscriptionPlan).set("updatedAt", Date()),
            props.coreUsersCollection,
        )
        val updated = mongoTemplate.findById(oid, Document::class.java, props.coreUsersCollection) ?: return null
        val plan = updated.getString("subscriptionPlan") ?: "free"
        auditEventService.insertEvent(
            entityType = "core_user",
            entityId = userId,
            action = "updated_plan",
            session = session,
            details = mapOf("subscriptionPlan" to plan),
        )
        return mapOf(
            "userId" to userId,
            "subscriptionPlan" to plan,
        )
    }

    fun patchEmail(session: ResolvedSession, userId: String, email: String): Map<String, Any?>? {
        if (!ObjectId.isValid(userId)) return null
        val oid = ObjectId(userId)
        mongoTemplate.findById(oid, Document::class.java, props.coreUsersCollection) ?: return null
        try {
            mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").`is`(oid)),
                Update().set("email", normalizeEmail(email)).set("updatedAt", Date()),
                props.coreUsersCollection,
            )
        } catch (_: DuplicateKeyException) {
            throw DuplicateEmailException()
        }
        val updated = mongoTemplate.findById(oid, Document::class.java, props.coreUsersCollection) ?: return null
        auditEventService.insertEvent(
            entityType = "core_user",
            entityId = userId,
            action = "updated_email",
            session = session,
            details = mapOf("email" to updated.getString("email")),
        )
        return mapOf(
            "userId" to userId,
            "email" to updated.getString("email"),
        )
    }

    fun getSettings(session: ResolvedSession, userId: String): Pair<Map<String, Any?>, List<Map<String, Any?>>>? {
        if (!ObjectId.isValid(userId)) return null
        val crit = Criteria.where("userId").`is`(userId)
        val q = Query.query(PortfolioMongoFilter.withTenantScopeCriteria(crit, session.tenantId.takeIf { it.isNotBlank() }))
        val doc = mongoTemplate.findOne(q, Document::class.java, props.adminUserSettingsCollection)
            ?: return null
        val settingsMap = documentToJsonishMap(doc)
        val assignedPersonaId = doc.getString("assignedPersonaId")
        val linked = resolveLinkedCollections(userId, session.tenantId.takeIf { it.isNotBlank() }, assignedPersonaId)
        return settingsMap to linked
    }

    fun putSettings(session: ResolvedSession, userId: String, body: Map<String, Any?>): SettingsPutResult {
        if (!ObjectId.isValid(userId)) {
            return SettingsPutResult.BadRequest(mapOf("error" to "Invalid user id"))
        }
        mongoTemplate.findById(ObjectId(userId), Document::class.java, props.coreUsersCollection)
            ?: return SettingsPutResult.NotFound(mapOf("error" to "User not found"))
        val parsed = parseSettingsPayload(body)
        val validationError = parsed.validationError
        if (validationError != null) {
            return SettingsPutResult.BadRequest(validationError)
        }
        val assignedPersonaId = parsed.assignedPersonaId
        if (assignedPersonaId != null) {
            val persona = personaService.getPersonaById(assignedPersonaId)
            if (persona == null) {
                return SettingsPutResult.PersonaNotFound
            }
            if (persona.getString("status") != "published") {
                return SettingsPutResult.PersonaNotPublished
            }
        }
        val tenantOid = PortfolioMongoFilter.tenantObjectId(session.tenantId)
        val update = Update()
        tenantOid?.let { update.set("tenantId", it) }
        update.set("userId", userId)
        parsed.finraLicenseUploadUrl?.let { update.set("finraLicenseUploadUrl", it) }
        if (parsed.assignedPersonaId != null) {
            update.set("assignedPersonaId", parsed.assignedPersonaId)
        } else {
            update.unset("assignedPersonaId")
        }
        update.set("broker", Document(parsed.broker!!))
        update.set("portfolio", Document(parsed.portfolio!!))
        update.set("account", Document(parsed.account!!))
        update.set("notificationDefaults", Document(parsed.notificationDefaults!!))
        update.set("updatedAt", Date())
        val upsertQuery = Query.query(
            PortfolioMongoFilter.withTenantScopeCriteria(
                Criteria.where("userId").`is`(userId),
                session.tenantId.takeIf { it.isNotBlank() },
            ),
        )
        mongoTemplate.upsert(upsertQuery, update, props.adminUserSettingsCollection)
        val reread = getSettings(session, userId)?.let { (settings, _) -> settings }
            ?: return SettingsPutResult.BadRequest(mapOf("error" to "Failed to upsert admin settings"))
        auditEventService.insertEvent(
            entityType = "core_user",
            entityId = userId,
            action = "updated_settings",
            session = session,
            details = mapOf("changedFields" to body.keys.toList()),
        )
        return SettingsPutResult.Ok(reread)
    }

    private fun upsertTenantMembership(
        userId: ObjectId,
        tenantId: ObjectId,
        role: String,
        isDefaultTenant: Boolean,
    ) {
        val now = Date()
        mongoTemplate.upsert(
            Query.query(Criteria.where("userId").`is`(userId).and("tenantId").`is`(tenantId)),
            Update()
                .setOnInsert("createdAt", now)
                .set("role", role)
                .set("isDefaultTenant", isDefaultTenant)
                .set("updatedAt", now),
            props.coreTenantMembershipsCollection,
        )
    }

    private fun loadLatestAuditForCoreUserIds(entityIds: List<String>): Map<String, Document> {
        if (entityIds.isEmpty()) return emptyMap()
        val q = Query.query(
            Criteria().andOperator(
                Criteria.where("entityType").`is`("core_user"),
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

    private fun loadAuditTrailForCoreUser(entityId: String): List<Map<String, Any?>> {
        val q = Query.query(
            Criteria().andOperator(
                Criteria.where("entityType").`is`("core_user"),
                Criteria.where("entityId").`is`(entityId),
            ),
        ).with(Sort.by(Sort.Direction.DESC, "createdAt"))
            .limit(20)
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

    private fun serializeCoreUser(doc: Document): Map<String, Any?> {
        val m = BsonJson.documentToMap(doc).toMutableMap()
        m["_id"] = doc.getObjectId("_id")?.toHexString()
        m.remove("passwordHash")
        return m
    }

    private fun documentToJsonishMap(doc: Document): Map<String, Any?> {
        val m = BsonJson.documentToMap(doc).toMutableMap()
        m["_id"] = doc.getObjectId("_id")?.toHexString()
        m["tenantId"] = doc["tenantId"]?.let { BsonJson.value(it) }
        m["updatedAt"] = doc.getDate("updatedAt")?.toInstant()?.toString()
        return m
    }

    private fun resolveLinkedCollections(
        userId: String,
        tenantId: String?,
        assignedPersonaId: String?,
    ): List<Map<String, Any?>> {
        val linked = mutableListOf<Map<String, Any?>>(
            mapOf(
                "collectionId" to ATXFINANCE_DEFAULT_COLLECTION_ID,
                "collectionName" to ATXFINANCE_DEFAULT_COLLECTION_NAME,
                "source" to "atxfinance_default",
            ),
        )
        val bootQ = Query.query(PortfolioMongoFilter.withTenantScopeCriteria(Criteria.where("userId").`is`(userId), tenantId))
            .with(Sort.by(Sort.Direction.DESC, "updatedAt"))
            .limit(1)
        val profile = mongoTemplate.findOne(bootQ, Document::class.java, props.adminUserBootstrapProfilesCollection)
        val bootId = profile?.getString("xaiCollectionId")?.trim()
        if (!bootId.isNullOrEmpty()) {
            val row = mutableMapOf<String, Any?>(
                "collectionId" to bootId,
                "source" to "user_bootstrap",
            )
            profile.getString("xaiCollectionName")?.trim()?.takeIf { it.isNotEmpty() }?.let {
                row["collectionName"] = it
            }
            linked.add(row)
        }
        val personaId = assignedPersonaId?.trim()
        if (!personaId.isNullOrEmpty() && ObjectId.isValid(personaId)) {
            val persona = personaService.getPersonaById(personaId)
            val xc = persona?.get("xaiCollection") as? Document
            val pid = xc?.getString("collectionId")?.trim()
            if (!pid.isNullOrEmpty()) {
                val row = mutableMapOf<String, Any?>(
                    "collectionId" to pid,
                    "source" to "assigned_persona",
                )
                xc.getString("collectionName")?.trim()?.takeIf { it.isNotEmpty() }?.let {
                    row["collectionName"] = it
                }
                linked.add(row)
            }
        }
        val deduped = linkedMapOf<String, Map<String, Any?>>()
        for (item in linked) {
            val id = (item["collectionId"] as? String)?.trim() ?: continue
            if (id.isEmpty() || deduped.containsKey(id)) continue
            deduped[id] = item + ("collectionId" to id)
        }
        return deduped.values.toList()
    }

    private fun parseSettingsPayload(body: Map<String, Any?>): ParsedSettings {
        val broker = body["broker"] as? Map<*, *>
        val portfolio = body["portfolio"] as? Map<*, *>
        val account = body["account"] as? Map<*, *>
        val notificationDefaults = body["notificationDefaults"] as? Map<*, *>
        if (broker == null || portfolio == null || account == null || notificationDefaults == null) {
            return ParsedSettings(validationError = mapOf("error" to "Invalid request payload"))
        }
        val assignedRaw = body["assignedPersonaId"] as? String
        val assignedPersonaId =
            if (assignedRaw.isNullOrBlank()) null else assignedRaw.trim()
        if (assignedPersonaId != null && !ObjectId.isValid(assignedPersonaId)) {
            return ParsedSettings(
                validationError = mapOf(
                    "error" to "Invalid request payload",
                    "details" to mapOf(
                        "fieldErrors" to mapOf(
                            "assignedPersonaId" to listOf("assignedPersonaId must be a valid persona ObjectId"),
                        ),
                    ),
                ),
            )
        }
        val finra = body["finraLicenseUploadUrl"] as? String
        val finraOut = if (finra.isNullOrBlank()) null else finra.trim().take(500)
        return ParsedSettings(
            assignedPersonaId = assignedPersonaId,
            finraLicenseUploadUrl = finraOut,
            broker = broker.entries.associate { it.key.toString() to it.value },
            portfolio = portfolio.entries.associate { it.key.toString() to it.value },
            account = account.entries.associate { it.key.toString() to it.value },
            notificationDefaults = notificationDefaults.entries.associate { it.key.toString() to it.value },
        )
    }

    private data class ParsedSettings(
        val assignedPersonaId: String? = null,
        val finraLicenseUploadUrl: String? = null,
        val broker: Map<String, Any?>? = null,
        val portfolio: Map<String, Any?>? = null,
        val account: Map<String, Any?>? = null,
        val notificationDefaults: Map<String, Any?>? = null,
        val validationError: Map<String, Any?>? = null,
    )

    sealed class SettingsPutResult {
        data class Ok(val data: Map<String, Any?>) : SettingsPutResult()
        data class BadRequest(val body: Map<String, Any?>) : SettingsPutResult()
        data class NotFound(val body: Map<String, Any?>) : SettingsPutResult()
        data object PersonaNotFound : SettingsPutResult()
        data object PersonaNotPublished : SettingsPutResult()
    }

    class DuplicateEmailException : RuntimeException("duplicate email")

    private fun normalizeEmail(email: String): String = email.trim().lowercase()

    companion object {
        private const val ATXFINANCE_DEFAULT_COLLECTION_ID = "collection_b75e188e-e7e6-4aa8-8e01-23caf0946236"
        private const val ATXFINANCE_DEFAULT_COLLECTION_NAME = "aTxFinance Default"
    }
}
