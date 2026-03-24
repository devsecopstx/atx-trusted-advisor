package com.atxfinance.backend.auth

import org.bson.types.ObjectId

data class OAuthAuthContext(
    val userId: ObjectId,
    val tenantId: ObjectId,
    val email: String,
    val roles: List<String>,
    val tenantRole: String,
    val xUserId: String?,
    val username: String?,
    val displayName: String?,
    val avatarUrl: String?,
)
