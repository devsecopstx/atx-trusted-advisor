package com.atxfinance.backend.xchat

import com.atxfinance.backend.session.ResolvedSession

data class AtxFunctionExecutionContext(
    val session: ResolvedSession,
    val portfolioIdHex: String?,
    val workspacePreload: Map<String, Any?>? = null,
)
