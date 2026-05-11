package com.atxfinance.backend.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.NestedConfigurationProperty

/**
 * JVM → Next delegate: [NextSchedulerExecuteClient] POSTs to Next `/api/internal/scheduler/execute-task`
 * with [internalSecret] so Yahoo-backed scanners run on the Node task-runner.
 */
data class SchedulerDelegateProps(
    /** Next Cloud Run origin (no trailing slash), e.g. `https://…run.app`. */
    val nextBaseUrl: String = "",
    /** Shared with Next `ATX_SCHEDULER_INTERNAL_SECRET` (min 24 chars when delegating). */
    val internalSecret: String = "",
)

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
    val xchatUserPreferencesCollection: String = "xchat_user_preferences",
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
    val strategyFinalizerModel: String = "grok-4.3",
    /**
     * When true and session is `global_admin`, run finalizer synchronously on the HTTP thread after the last slot turn
     * (still returns 200 from `POST …/turns`; may exceed typical gateway timeouts for heavy models).
     */
    val strategyFinalizerSyncForGlobalAdmin: Boolean = false,
    /** When true and session is `global_admin`, send `agent_count` + `reasoning` for multi-agent finalizer models. */
    val strategyFinalizerMultiAgentForGlobalAdmin: Boolean = true,
    /**
     * When true, strategy artifact generation should use xAI **Batch** (`/v1/batches`) instead of synchronous chat completions.
     * **Not wired on the JVM yet** — finalizer logs once and still uses synchronous chat completions.
     * Env: `STRATEGY_FINALIZER_USE_XAI_BATCH`.
     */
    val strategyFinalizerUseXaiBatch: Boolean = false,
    /** Optional explicit team KB `collection_*` id when `XAI_TEAM_ID` is a team UUID (env `STRATEGY_TEAM_KB_COLLECTION_ID`). */
    val strategyTeamKbCollectionId: String = "",
    /** Mongo collection for materialized xChat workspace preload rows (Next + JVM read/purge). */
    val portfolioWorkspaceSnapshotsCollection: String = "portfolio_workspace_snapshots",
    /** When true, [com.atxfinance.backend.scheduling.PortfolioWorkspaceSnapshotPurgeJob] removes old snapshot rows. */
    val portfolioWorkspaceSnapshotPurgeEnabled: Boolean = true,
    /** Delete `portfolio_workspace_snapshots` rows with `materializedAt` older than this many days. */
    val portfolioWorkspaceSnapshotPurgeRetentionDays: Int = 14,
    /** Fixed-rate interval (ms) for purge job. */
    val portfolioWorkspaceSnapshotPurgeIntervalMs: Long = 21_600_000L,
    /**
     * Gates JVM outlook refresh scheduler hooks + aligns with Next `INVESTMENT_OUTLOOK_REFRESH_ENABLED`.
     * Job wiring is incremental — properties are carried for shared configuration.
     */
    val investmentOutlookRefreshEnabled: Boolean = false,
    /** Optional Quartz/cron expression for outlook refresh (when job ships). */
    val investmentOutlookRefreshCron: String = "",
    /** xAI model id for macro outlook synthesis. */
    val xaiOutlookModel: String = "grok-3-latest",
    @NestedConfigurationProperty
    val redis: RedisProps = RedisProps(),
    @NestedConfigurationProperty
    val scheduler: SchedulerProps = SchedulerProps(),
    /**
     * When [SchedulerDelegateProps.nextBaseUrl] and [SchedulerDelegateProps.internalSecret] are set, JVM scheduled
     * execution delegates to Next **`POST /api/internal/scheduler/execute-task`** so Yahoo-backed jobs run for real.
     */
    @NestedConfigurationProperty
    val schedulerDelegate: SchedulerDelegateProps = SchedulerDelegateProps(),
)

/** Optional Memorystore / Redis — empty [RedisProps.url] disables Redis-backed features. */
data class RedisProps(
    /** `redis://` or `rediss://` (same as Next `REDIS_URL`). */
    val url: String = "",
    /** Dedicated control-plane URL (auth/PKCE/rate/quota). Falls back to [url]. */
    val controlUrl: String = "",
    /** Dedicated cache-plane URL (workspace snapshots, option-chain cache). Falls back to [url]. */
    val cacheUrl: String = "",
    /**
     * When true, a `rediss://` URL is dialed as plain TCP (matches Next when `REDIS_TLS=false`
     * against a non-TLS port).
     */
    val tlsPlainWithRediss: Boolean = false,
    /** Low command timeout keeps Redis hiccups from stalling HTTP/Scheduler threads. */
    val commandTimeoutMs: Long = 750,
    /** Connect timeout for socket dialing/reconnect attempts. */
    val connectTimeoutMs: Long = 750,
    /** Pool max active connections per Cloud Run instance. */
    val poolMaxActive: Int = 6,
    /** Pool max idle connections retained. */
    val poolMaxIdle: Int = 6,
    /** Pool min idle connections retained. */
    val poolMinIdle: Int = 1,
    /** Max wait for a pooled connection before failing fast. */
    val poolMaxWaitMs: Long = 300,
    /** Idle connections older than this are evicted proactively. */
    val poolMinEvictableIdleMs: Long = 60_000,
    /** Periodic idle-eviction sweep interval. */
    val poolEvictionRunIntervalMs: Long = 30_000,
    /** Adaptive reconnect backoff lower bound (ms). */
    val reconnectBackoffMinMs: Long = 200,
    /** Adaptive reconnect backoff upper bound (ms). */
    val reconnectBackoffMaxMs: Long = 10_000,
    /** OAuth PKCE verifier row TTL (seconds). */
    val pkceTtlSeconds: Long = 600,
    /** Max GET `/api/auth/x/login` per client IP per rolling minute (0 = disable). */
    val authLoginLimitPerMinute: Int = 30,
    /** Max GET `/api/auth/x/callback` per client IP per rolling minute (0 = disable). */
    val authCallbackLimitPerMinute: Int = 60,
    /** PKCE + OAuth flow cookie Max-Age when Spring issues login redirect (align with Next: 30m). */
    val oauthFlowCookieMaxAgeSeconds: Int = 1800,
    /**
     * `GET /api/portfolios/{portfolioId}/snapshot` — Redis TTL when US regular session is **likely open**
     * ([com.atxfinance.backend.portfolio.UsEquitiesRegularSession]).
     */
    val portfolioSnapshotTtlOpenSeconds: Long = 60,
    /** Same route — TTL when session is **likely closed** (evenings/weekends; holidays not modeled). */
    val portfolioSnapshotTtlClosedSeconds: Long = 300,
    /**
     * Redis TTL for raw Yahoo option-chain JSON (`StrategyOptionsYahooClient`) when US regular session is likely open.
     * Env: `OPTION_CHAIN_CACHE_TTL_OPEN_SECONDS`.
     */
    val optionChainCacheTtlOpenSeconds: Long = 120,
    /** Yahoo option-chain JSON cache TTL when session likely closed. Env: `OPTION_CHAIN_CACHE_TTL_CLOSED_SECONDS`. */
    val optionChainCacheTtlClosedSeconds: Long = 900,
)

/**
 * Internal poll of [AtxfinanceProperties.scheduledTasksCollection] for due tenant-level jobs.
 * Cloud Run: prefer **min-instances ≥ 1** on the backend so ticks run without an external cron.
 * Multi-replica: [com.atxfinance.backend.scheduling.AdminSchedulerPoller] uses ShedLock; per-task locks
 * live in [com.atxfinance.backend.admin.AdminScheduledTasksService].
 */
data class SchedulerProps(
    /** When false, no background poll runs (Quartz or simple). */
    val enabled: Boolean = true,
    /**
     * `simple` = Spring `@Scheduled` [com.atxfinance.backend.scheduling.AdminSchedulerPoller].
     * `quartz` = Quartz RAM store + repeating trigger (standard scheduler API for prod MVP).
     */
    val driver: String = "quartz",
    /** Poll interval for due-task scan (Quartz trigger or simple `@Scheduled` rate). */
    val pollIntervalMs: Long = 60_000L,
    /** Cap due tasks claimed per poll (across tenants). */
    val maxTasksPerPoll: Int = 50,
)
