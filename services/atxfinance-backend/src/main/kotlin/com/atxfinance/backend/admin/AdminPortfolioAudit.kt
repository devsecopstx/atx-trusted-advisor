package com.atxfinance.backend.admin

/** PLAN 601 — `admin_audit_events.entityType` for global-admin portfolio mutations (Spring / BFF path). */
internal object AdminPortfolioAudit {
    const val ENTITY_TYPE: String = "admin_portfolio"
}

internal fun csvSymbols(list: List<String>?): String? {
    if (list.isNullOrEmpty()) {
        return null
    }
    return list.joinToString(",") { it.trim().uppercase() }.take(2048)
}
