package com.atxfinance.backend.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.NestedConfigurationProperty

@ConfigurationProperties(prefix = "app.atxfinance")
data class AtxfinanceProperties(
    val sessionCookieName: String = "xf_core_session",
    val portfoliosCollection: String = "tenant_portfolio",
    val accountsCollection: String = "portfolio_accounts",
    val watchlistsCollection: String = "portfolio_watchlists",
    val positionsCollection: String = "portfolio_positions",
    val personasCollection: String = "xchat_personas",
    val accessRequestsCollection: String = "admin_access_requests",
    val adminUserSettingsCollection: String = "admin_user_settings",
    val adminUserBootstrapProfilesCollection: String = "admin_user_bootstrap_profiles",
    val coreTenantMembershipsCollection: String = "core_tenant_memberships",
    val coreUsersCollection: String = "core_users",
    val auditEventsCollection: String = "admin_audit_events",
    val scheduledTasksCollection: String = "admin_scheduled_tasks",
    val taskRunsCollection: String = "admin_task_runs",
    val deployNoteConfigsCollection: String = "admin_deploy_note_configs",
    val adminDeliveryChannelsCollection: String = "admin_delivery_channels",
    val appUserRecommendationsCollection: String = "app_user_recommendations",
    val portfolioRecommendationsCollection: String = "portfolio_recommendations",
    val portfolioAlertsCollection: String = "portfolio_alerts",
    val portfolioDeliveryChannelsCollection: String = "portfolio_delivery_channels",
    val ragFilesCollection: String = "xai_collections",
    val ragChunksCollection: String = "xchat_rag_chunks",
    val xchatLogsCollection: String = "xchat_logs",
    val defaultExtBrokerRef: String = "extBrokerName",
    val defaultAccountCashBalance: Double = 25_000.0,
    val tenantPortfolioOrgKey: String = "org-atx-finance",
    val maxWatchlistSymbols: Int = 75,
    val maxWatchlistSymbolsPerPatch: Int = 20,
    /** Phase 1 multi-agent strategy job rows (orchestrator). */
    val strategyJobsCollection: String = "strategy_jobs",
    /**
     * Days after job creation when the document may be removed by a TTL index on `expiresAt`.
     * **0** disables TTL index creation and omits `expiresAt` on new inserts.
     */
    val strategyJobsTtlDays: Int = 90,
    val strategyMaxJobsHourly: Int = 12,
    val strategySoftWarnJobsHourly: Int = 8,
    /** xAI chat model for strategy job LLM finalizer (env `STRATEGY_FINALIZER_MODEL`). */
    val strategyFinalizerModel: String = "grok-4-1-fast-reasoning",
    /**
     * When true and session is `global_admin`, run finalizer synchronously on the HTTP thread after the last slot turn
     * (still returns 200 from `POST …/turns`; may exceed typical gateway timeouts for heavy models).
     */
    val strategyFinalizerSyncForGlobalAdmin: Boolean = false,
    /** When true and session is `global_admin`, send `agent_count` + `reasoning` for multi-agent finalizer models. */
    val strategyFinalizerMultiAgentForGlobalAdmin: Boolean = true,
    /** Optional explicit team KB `collection_*` id when `XAI_TEAM_ID` is a team UUID (env `STRATEGY_TEAM_KB_COLLECTION_ID`). */
    val strategyTeamKbCollectionId: String = "",
    @NestedConfigurationProperty
    val redis: RedisProps = RedisProps(),
)

/** Optional Memorystore / Redis — empty [RedisProps.url] disables Redis-backed features. */
data class RedisProps(
    /** `redis://` or `rediss://` (same as Next `REDIS_URL`). */
    val url: String = "",
    /**
     * When true, a `rediss://` URL is dialed as plain TCP (matches Next when `REDIS_TLS=false`
     * against a non-TLS port).
     */
    val tlsPlainWithRediss: Boolean = false,
    /** OAuth PKCE verifier row TTL (seconds). */
    val pkceTtlSeconds: Long = 600,
    /** Max GET `/api/auth/x/login` per client IP per rolling minute (0 = disable). */
    val authLoginLimitPerMinute: Int = 30,
    /** Max GET `/api/auth/x/callback` per client IP per rolling minute (0 = disable). */
    val authCallbackLimitPerMinute: Int = 60,
    /** PKCE + OAuth flow cookie Max-Age when Spring issues login redirect (align with Next: 30m). */
    val oauthFlowCookieMaxAgeSeconds: Int = 1800,
)
