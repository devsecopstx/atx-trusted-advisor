package com.atxfinance.backend.identity

import com.atxfinance.backend.config.AtxfinanceProperties
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.data.mongodb.core.query.Update
import org.springframework.stereotype.Service
import java.util.Date

@Service
class CoreUserService(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
) {
    fun getById(userId: String): Document? {
        if (!ObjectId.isValid(userId)) {
            return null
        }
        return mongoTemplate.findById(ObjectId(userId), Document::class.java, props.coreUsersCollection)
    }

    fun ensureByEmail(emailRaw: String): Document {
        val email = normalizeEmail(emailRaw)
        val now = Date()
        val onInsert = Document()
        onInsert["email"] = email
        onInsert["roles"] = emptyList<String>()
        onInsert["status"] = "active"
        onInsert["subscriptionPlan"] = "free"
        onInsert["createdAt"] = now
        onInsert["updatedAt"] = now
        mongoTemplate.upsert(
            Query.query(Criteria.where("email").`is`(email)),
            Update()
                .setOnInsert("email", email)
                .setOnInsert("roles", emptyList<String>())
                .setOnInsert("status", "active")
                .setOnInsert("subscriptionPlan", "free")
                .setOnInsert("createdAt", now)
                .setOnInsert("updatedAt", now),
            props.coreUsersCollection,
        )
        return mongoTemplate.findOne(Query.query(Criteria.where("email").`is`(email)), Document::class.java, props.coreUsersCollection)
            ?: error("Failed to ensure core user")
    }

    fun addRole(userId: ObjectId, role: String): Document {
        val now = Date()
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(userId)),
            Update().addToSet("roles", role).set("updatedAt", now),
            props.coreUsersCollection,
        )
        return getById(userId.toHexString()) ?: error("Failed to add role")
    }

    fun setSubscriptionPlan(userId: ObjectId, plan: String): Document {
        val now = Date()
        mongoTemplate.updateFirst(
            Query.query(Criteria.where("_id").`is`(userId)),
            Update().set("subscriptionPlan", plan).set("updatedAt", now),
            props.coreUsersCollection,
        )
        return getById(userId.toHexString()) ?: error("Failed to update subscription plan")
    }

    fun loadUsersForSummaries(userIds: Collection<String>): Map<String, Document> {
        val oids = userIds.filter { ObjectId.isValid(it) }.map { ObjectId(it) }.distinct()
        if (oids.isEmpty()) {
            return emptyMap()
        }
        val q = Query.query(Criteria.where("_id").`in`(oids))
        val docs = mongoTemplate.find(q, Document::class.java, props.coreUsersCollection)
        return docs.associateBy { it.getObjectId("_id")!!.toHexString() }
    }

    fun toUserSummary(doc: Document): Map<String, Any?> {
        val x = doc["xAccount"] as? Document
        return mapOf(
            "userId" to doc.getObjectId("_id")?.toHexString(),
            "email" to doc.getString("email"),
            "status" to doc.getString("status"),
            "roles" to (doc["roles"] as? List<*> ?: emptyList<Any>()),
            "subscriptionPlan" to doc.getString("subscriptionPlan"),
            "xUserId" to x?.getString("xUserId"),
            "username" to x?.getString("username"),
            "displayName" to x?.getString("displayName"),
            "avatarUrl" to x?.getString("avatarUrl"),
            "lastLoginAt" to (doc.getDate("lastLoginAt")?.toInstant()?.toString()),
            "lastLoginIp" to doc.getString("lastLoginIp"),
            "lastLoginCountry" to doc.getString("lastLoginCountry"),
            "lastLoginUserAgent" to doc.getString("lastLoginUserAgent"),
        )
    }

    private fun normalizeEmail(email: String): String = email.trim().lowercase()
}
