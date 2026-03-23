package com.atxfinance.backend.web

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.session.SessionCookieParser
import com.atxfinance.backend.session.isGlobalAdmin
import jakarta.servlet.http.HttpServletRequest
import org.bson.Document
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class AdminBootstrapController(
    private val props: AtxfinanceProperties,
    private val sessionCookieParser: SessionCookieParser,
    private val mongoTemplate: MongoTemplate,
    @Value("\${ADMIN_SEED_EMAIL:}") private val adminSeedEmailRaw: String,
) {

    @GetMapping("/api/admin/bootstrap-status")
    fun get(request: HttpServletRequest): ResponseEntity<Map<String, Any?>> {
        val session = sessionCookieParser.resolveSessionUser(
            request.getHeader("Cookie"),
            props.sessionCookieName,
        ) ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(mapOf("error" to "Unauthorized"))
        if (!session.isGlobalAdmin()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "Forbidden"))
        }

        val seedEmailConfigured = adminSeedEmailRaw.trim().isNotEmpty()
        val seedEmail = adminSeedEmailRaw.trim().lowercase().takeIf { it.isNotEmpty() }

        val userNames = mongoTemplate.indexOps("core_users").indexInfo.map { it.name }.toSet()
        val tenantNames = mongoTemplate.indexOps("core_tenants").indexInfo.map { it.name }.toSet()
        val membershipNames = mongoTemplate.indexOps("core_tenant_memberships").indexInfo.map { it.name }.toSet()

        val expectedUsers = listOf("uniq_core_user_email", "uniq_core_user_x_user_id")
        val expectedTenants = listOf("uniq_tenant_slug", "uniq_default_tenant")
        val expectedMemberships = listOf("uniq_membership_user_tenant")

        val hasAllIndexes =
            expectedUsers.all { userNames.contains(it) } &&
                expectedTenants.all { tenantNames.contains(it) } &&
                expectedMemberships.all { membershipNames.contains(it) }

        val seededUser: Document? = seedEmail?.let { email ->
            mongoTemplate.findOne(
                Query.query(Criteria.where("email").`is`(email)),
                Document::class.java,
                "core_users",
            )
        }
        val defaultTenant: Document? = mongoTemplate.findOne(
            Query.query(Criteria.where("isDefault").`is`(true)),
            Document::class.java,
            "core_tenants",
        )

        val hasSeededUser = seededUser?.getObjectId("_id") != null
        val hasDefaultTenant = defaultTenant?.getObjectId("_id") != null

        val seededMembership = if (seededUser != null && defaultTenant != null) {
            val uid = seededUser.getObjectId("_id")
            val tid = defaultTenant.getObjectId("_id")
            mongoTemplate.findOne(
                Query.query(
                    Criteria().andOperator(
                        Criteria.where("userId").`is`(uid),
                        Criteria.where("tenantId").`is`(tid),
                        Criteria.where("isDefaultTenant").`is`(true),
                    ),
                ),
                Document::class.java,
                "core_tenant_memberships",
            )
        } else {
            null
        }
        val hasSeededMembership = seededMembership?.getObjectId("_id") != null

        val healthy = hasAllIndexes && hasSeededUser && hasDefaultTenant && hasSeededMembership && seedEmailConfigured

        val usersIdxRows: List<Map<String, Any?>> = expectedUsers.map { n ->
            mapOf<String, Any?>("name" to n, "exists" to userNames.contains(n))
        }
        val tenantsIdxRows: List<Map<String, Any?>> = expectedTenants.map { n ->
            mapOf<String, Any?>("name" to n, "exists" to tenantNames.contains(n))
        }
        val membershipsIdxRows: List<Map<String, Any?>> = expectedMemberships.map { n ->
            mapOf<String, Any?>("name" to n, "exists" to membershipNames.contains(n))
        }
        val data: Map<String, Any?> = mapOf(
            "healthy" to healthy,
            "seedEmailConfigured" to seedEmailConfigured,
            "seedEmail" to seedEmail,
            "indexes" to mapOf<String, Any?>(
                "healthy" to hasAllIndexes,
                "users" to usersIdxRows,
                "tenants" to tenantsIdxRows,
                "memberships" to membershipsIdxRows,
            ),
            "seedEntities" to mapOf<String, Any?>(
                "userExists" to hasSeededUser,
                "defaultTenantExists" to hasDefaultTenant,
                "defaultMembershipExists" to hasSeededMembership,
            ),
            "context" to mapOf<String, Any?>(
                "requestingUser" to (session.email ?: ""),
                "requestingTenantId" to session.tenantId,
            ),
        )
        return ResponseEntity.ok(mapOf("data" to data))
    }
}
