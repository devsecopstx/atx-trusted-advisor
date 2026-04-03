package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import org.springframework.core.env.Environment
import org.springframework.stereotype.Component

/**
 * Phase 1 TEAM KB: prefer literal `collection_*` from [Environment] `XAI_TEAM_ID`, else optional
 * [AtxfinanceProperties.strategyTeamKbCollectionId] (`STRATEGY_TEAM_KB_COLLECTION_ID`).
 */
@Component
class StrategyTeamKbResolver(
    private val env: Environment,
    private val props: AtxfinanceProperties,
) {
    fun resolveCollectionIds(): List<String> {
        val explicit = props.strategyTeamKbCollectionId.trim()
        if (explicit.startsWith("collection_")) {
            return listOf(explicit)
        }
        val raw = env.getProperty("XAI_TEAM_ID")?.trim().orEmpty()
        if (raw.startsWith("collection_")) {
            return listOf(raw)
        }
        return emptyList()
    }
}
