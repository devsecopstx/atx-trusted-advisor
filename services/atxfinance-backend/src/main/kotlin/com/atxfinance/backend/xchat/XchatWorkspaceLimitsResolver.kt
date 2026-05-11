package com.atxfinance.backend.xchat

import com.atxfinance.backend.identity.CoreUserService
import com.atxfinance.backend.session.ResolvedSession
import org.bson.Document
import org.bson.types.ObjectId
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.stereotype.Service

data class XchatWorkspacePromptCaps(
    val subscriptionPlan: String?,
    val dailyPromptLimit: Int?,
    val hourlyPromptLimit: Int?,
)

@Service
class XchatWorkspaceLimitsResolver(
    private val mongoTemplate: MongoTemplate,
    private val coreUserService: CoreUserService,
) {
    fun resolveForSession(session: ResolvedSession): XchatWorkspacePromptCaps {
        val user = coreUserService.getById(session.userId)
        val subscriptionPlan = user?.getString("subscriptionPlan")?.trim()?.takeIf { it.isNotEmpty() }
        val tenant =
            if (ObjectId.isValid(session.tenantId)) {
                mongoTemplate.findById(ObjectId(session.tenantId), Document::class.java, "core_tenants")
            } else {
                null
            }
        val workspaceLimits = tenant?.get("workspaceLimits", Document::class.java)
        val daily = positiveInt(workspaceLimits?.get("userChatLimit"))
        val hourly = positiveInt(workspaceLimits?.get("userChatHourlyLimit"))
        val effectiveDaily = daily ?: XchatPlanLimits.maxPromptsPerDay(subscriptionPlan)
        return XchatWorkspacePromptCaps(
            subscriptionPlan = subscriptionPlan,
            dailyPromptLimit = effectiveDaily,
            hourlyPromptLimit = hourly,
        )
    }

    private fun positiveInt(value: Any?): Int? {
        val n = (value as? Number)?.toInt() ?: return null
        return if (n > 0) n else null
    }
}
