package com.atxfinance.backend.xchat

import com.atxfinance.backend.config.AtxfinanceProperties
import com.atxfinance.backend.portfolio.PortfolioMongoFilter
import com.atxfinance.backend.persona.PersonaService
import com.atxfinance.backend.session.ResolvedSession
import com.atxfinance.backend.session.isGlobalAdmin
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.query.Criteria
import org.springframework.data.mongodb.core.query.Query
import org.springframework.stereotype.Service

@Service
class XchatPersonaResolver(
    private val mongoTemplate: MongoTemplate,
    private val props: AtxfinanceProperties,
    private val personaService: PersonaService,
    private val platformSettingsService: XchatPlatformSettingsService,
) {
    fun resolveForAsk(
        session: ResolvedSession,
        requestedPersonaId: String?,
    ): Document? {
        val defaultPersona = resolveDefaultPersona(session) ?: return null
        val assignedPersonaId = loadAssignedPersonaId(session)
        val allowRequestOverride = session.isGlobalAdmin() || assignedPersonaId.isNullOrBlank()
        val candidates = mutableListOf<String>()
        if (allowRequestOverride) {
            requestedPersonaId?.trim()?.takeIf { it.isNotEmpty() }?.let(candidates::add)
        }
        assignedPersonaId?.let(candidates::add)
        for (candidate in candidates.distinct()) {
            val persona = loadAccessiblePersona(session, candidate, assignedPersonaId == candidate)
            if (persona != null) {
                return persona
            }
        }
        return defaultPersona
    }

    private fun resolveDefaultPersona(session: ResolvedSession): Document? {
        if (session.isGlobalAdmin()) {
            for (nameKey in GLOBAL_ADMIN_DEFAULT_NAME_KEYS) {
                val row = findPersonaByNormalizedName(nameKey)
                if (row != null) {
                    return row
                }
            }
        }
        val platform = platformSettingsService.loadSettings()
        val platformPersonaId = platform?.getString("defaultAppUserPersonaId")?.trim()
        if (!platformPersonaId.isNullOrEmpty() && ObjectId.isValid(platformPersonaId)) {
            val published = personaService.getPersonaById(platformPersonaId)
            if (published?.getString("status") == "published") {
                return published
            }
        }
        return findPersonaByNormalizedName(TRUSTED_ADVISOR_NAME_KEY)
    }

    private fun loadAssignedPersonaId(session: ResolvedSession): String? {
        val filter =
            Criteria.where("userId").`is`(session.userId)
        val tenantOid = PortfolioMongoFilter.tenantObjectId(session.tenantId)
        val query =
            if (tenantOid != null) {
                Query.query(Criteria().andOperator(filter, Criteria.where("tenantId").`is`(tenantOid)))
            } else {
                Query.query(filter)
            }
        val doc = mongoTemplate.findOne(query, Document::class.java, props.adminUserSettingsCollection)
        return doc?.getString("assignedPersonaId")?.trim()?.takeIf { it.isNotEmpty() }
    }

    private fun loadAccessiblePersona(
        session: ResolvedSession,
        personaId: String,
        isAssigned: Boolean,
    ): Document? {
        val persona =
            if (ObjectId.isValid(personaId)) {
                personaService.getPersonaById(personaId)
            } else {
                findPersonaByNormalizedName(personaId.lowercase())
            }
            ?: return null
        if (!session.isGlobalAdmin()) {
            if (persona.getString("status") != "published") {
                return if (isAssigned) null else null
            }
        }
        return persona
    }

    private fun findPersonaByNormalizedName(nameKey: String): Document? {
        val q =
            Query.query(
                Criteria.where("nameNormalized").`is`(nameKey),
            )
        return mongoTemplate.findOne(q, Document::class.java, props.personasCollection)
    }

    companion object {
        private val GLOBAL_ADMIN_DEFAULT_NAME_KEYS = listOf("advisor", "atx-trusted-advisor")
        private const val TRUSTED_ADVISOR_NAME_KEY = "atx-trusted-advisor"
    }
}
