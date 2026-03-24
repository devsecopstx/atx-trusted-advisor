package com.atxfinance.backend.identity

import com.atxfinance.backend.auth.OAuthAuthContext
import com.atxfinance.backend.config.AtxfinanceProperties
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.util.Date

/**
 * Resolves or creates core user + tenant membership from OAuth callback.
 * Aligns with Next.js identity/repository: getCoreUserByXIdentity, linkXAccountToUser,
 * ensureCoreUserByEmail, ensureDefaultTenant, upsertTenantMembership.
 */
@Service
class OAuthIdentityService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    /**
     * Returns null if user lacks login-eligible role (access_request_pending).
     */
    fun resolveOrCreateUserFromOAuth(
        xUserId: String,
        username: String,
        displayName: String?,
        avatarUrl: String?,
        emailFromProvider: String?,
    ): OAuthAuthContext? {
        val tenantsCol = "core_tenants"
        val membershipsCol = props.coreTenantMembershipsCollection

        var userDoc = getByXIdentity(xUserId)
        if (userDoc == null && emailFromProvider != null) {
            userDoc = ensureByEmail(emailFromProvider)
        }
        if (userDoc == null && emailFromProvider == null) {
            val placeholderEmail = "x_${xUserId}@placeholder.atxfinance.local"
            userDoc = ensureByEmail(placeholderEmail)
            linkXAccount(userDoc.getObjectId("_id")!!, xUserId, username, displayName, avatarUrl)
        }
        if (userDoc != null && emailFromProvider != null) {
            val existingByEmail = getByEmail(emailFromProvider)
            if (existingByEmail != null) {
                val existingId = existingByEmail.getObjectId("_id")!!
                val currentId = userDoc.getObjectId("_id")!!
                if (existingId != currentId && canUserLogin(existingByEmail)) {
                    unlinkXAccount(currentId)
                    userDoc = linkXAccount(existingId, xUserId, username, displayName, avatarUrl)
                } else {
                    userDoc = linkXAccount(currentId, xUserId, username, displayName, avatarUrl)
                }
            } else {
                userDoc = ensureByEmail(emailFromProvider)
                userDoc = linkXAccount(userDoc.getObjectId("_id")!!, xUserId, username, displayName, avatarUrl)
            }
        } else if (userDoc != null) {
            userDoc = linkXAccount(userDoc.getObjectId("_id")!!, xUserId, username, displayName, avatarUrl)
        }

        if (userDoc == null) return null

        val userId = userDoc.getObjectId("_id")!!
        val roles = (userDoc["roles"] as? List<*>)?.mapNotNull { it?.toString() }?.filter { it.isNotBlank() } ?: emptyList()
        if (!canUserLogin(userDoc)) {
            return null
        }

        val tenant = ensureDefaultTenant(tenantsCol)
        val tenantId = tenant.getObjectId("_id")!!
        upsertTenantMembership(membershipsCol, userId, tenantId, "tenant_admin", isDefaultTenant = true)

        val xAccount = userDoc["xAccount"] as? Document
        val effectiveRoles = if (roles.any { it == "global_admin" || it == "admin" }) roles else (roles.ifEmpty { listOf("viewer") })
        return OAuthAuthContext(
            userId = userId,
            tenantId = tenantId,
            email = userDoc.getString("email") ?: "",
            roles = effectiveRoles,
            tenantRole = "tenant_admin",
            xUserId = xAccount?.getString("xUserId") ?: xUserId,
            username = xAccount?.getString("username") ?: username,
            displayName = xAccount?.getString("displayName") ?: displayName,
            avatarUrl = xAccount?.getString("avatarUrl") ?: avatarUrl,
        )
    }

    private fun getByXIdentity(xUserId: String): Document? {
        return mongoTemplate.findOne(
            Query.query(Criteria.where("xAccount.xUserId").`is`(xUserId)),
            Document::class.java,
            props.coreUsersCollection,
        )
    }

    private fun getByEmail(email: String): Document? {
        val normalized = email.trim().lowercase()
        return mongoTemplate.findOne(
            Query.query(Criteria.where("email").`is`(normalized)),
            Document::class.java,
            props.coreUsersCollection,
        )
    }

    private fun ensureByEmail(email: String): Document {
        val normalized = email.trim().lowercase()
        val now = Date()
        mongoTemplate.upsert(
            Query.query(Criteria.where("email").`is`(normalized)),
            Update()
                .setOnInsert("email", normalized)
                .setOnInsert("roles", emptyList<String>())
                .setOnInsert("status", "active")
                .setOnInsert("subscriptionPlan", "free")
                .setOnInsert("createdAt", now)
                .setOnInsert("updatedAt", now),
            props.coreUsersCollection,
        )
        return mongoTemplate.findOne(
            Query.query(Criteria.where("email").`is`(normalized)),
            Document::class.java,
            props.coreUsersCollection,
        ) ?: error("Failed to ensure core user")
    }

    private fun linkXAccount(
        userId: ObjectId,
        xUserId: String,
        username: String,
        displayName: String?,
        avatarUrl: String?,
    ): Document {
        val now = Date()
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(userId)),
            Update()
                .set("xAccount.xUserId", xUserId)
                .set("xAccount.username", username)
                .set("xAccount.displayName", displayName)
                .set("xAccount.avatarUrl", avatarUrl)
                .set("xAccount.linkedAt", now)
                .set("updatedAt", now)
                .set("lastLoginAt", now),
            props.coreUsersCollection,
        )
        return mongoTemplate.findById(userId, Document::class.java, props.coreUsersCollection)
            ?: error("Failed to link X account")
    }

    private fun unlinkXAccount(userId: ObjectId) {
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(userId)),
            Update().unset("xAccount").set("updatedAt", Date()),
            props.coreUsersCollection,
        )
    }

    private fun ensureDefaultTenant(tenantsCol: String): Document {
        val slug = "atxfinance-core"
        val now = Date()
        mongoTemplate.upsert(
            Query.query(Criteria.where("slug").`is`(slug)),
            Update()
                .setOnInsert("slug", slug)
                .setOnInsert("name", "atxFinance Core")
                .setOnInsert("createdAt", now)
                .set("updatedAt", now)
                .set("isDefault", true),
            tenantsCol,
        )
        return mongoTemplate.findOne(
            Query.query(Criteria.where("slug").`is`(slug)),
            Document::class.java,
            tenantsCol,
        ) ?: error("Failed to ensure default tenant")
    }

    private fun upsertTenantMembership(
        membershipsCol: String,
        userId: ObjectId,
        tenantId: ObjectId,
        role: String,
        isDefaultTenant: Boolean,
    ) {
        val now = Date()
        mongoTemplate.upsert(
            Query.query(
                Criteria.where("userId").`is`(userId).and("tenantId").`is`(tenantId),
            ),
            Update()
                .set("userId", userId)
                .set("tenantId", tenantId)
                .set("role", role)
                .set("isDefaultTenant", isDefaultTenant)
                .set("updatedAt", now)
                .setOnInsert("createdAt", now),
            membershipsCol,
        )
    }

    private fun canUserLogin(userDoc: Document): Boolean {
        val roles = (userDoc["roles"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
        return roles.any { it == "global_admin" || it == "advisor" || it == "operator" || it == "viewer" }
    }
}
