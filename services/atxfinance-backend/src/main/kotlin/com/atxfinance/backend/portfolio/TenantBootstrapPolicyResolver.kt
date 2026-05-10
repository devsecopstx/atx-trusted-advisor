package com.atxfinance.backend.portfolio

import org.bson.Document
import org.slf4j.LoggerFactory

/**
 * Mirrors Next.js [effectiveTenantBootstrapPolicy], [pickBootstrapPlatformRole],
 * [resolveBootstrapFlagsForRole], [resolveWatchlistSeedSymbols] so JVM OAuth /
 * access-request provision respects tenant bootstrap prefs.
 */
enum class BootstrapPlatformRole {
    ADVISOR,
    OPERATOR,
    VIEWER,
}

data class TenantBootstrapDecision(
    val provisionPortfolio: Boolean,
    /**
     * Passed to [DefaultPortfolioProvisionService.provision] as watchlist symbol seeds
     * (merged with default TSLA). `null` means TSLA-only extra seeds (watchlist disabled by policy).
     */
    val watchlistSeedList: List<String>?,
)

object TenantBootstrapPolicyResolver {
    private val log = LoggerFactory.getLogger(TenantBootstrapPolicyResolver::class.java)

    private val deskDefaults = listOf("TSLA", "NVDA", "AAPL", "AMD")

    private val defaultPortfolioAllFalse =
        mapOf(
            BootstrapPlatformRole.VIEWER to false,
            BootstrapPlatformRole.OPERATOR to false,
            BootstrapPlatformRole.ADVISOR to false,
        )
    private val defaultPortfolioStandard =
        mapOf(
            BootstrapPlatformRole.VIEWER to false,
            BootstrapPlatformRole.OPERATOR to true,
            BootstrapPlatformRole.ADVISOR to true,
        )
    private val defaultWatchlistAllFalse =
        mapOf(
            BootstrapPlatformRole.VIEWER to false,
            BootstrapPlatformRole.OPERATOR to false,
            BootstrapPlatformRole.ADVISOR to false,
        )
    private val defaultWatchlistStandard =
        mapOf(
            BootstrapPlatformRole.VIEWER to false,
            BootstrapPlatformRole.OPERATOR to true,
            BootstrapPlatformRole.ADVISOR to true,
        )

    private data class ParsedPolicy(
        val defaultPortfolio: Map<BootstrapPlatformRole, Boolean>,
        val defaultWatchlist: Map<BootstrapPlatformRole, Boolean>,
        val overrides: List<Override>,
    ) {
        data class Override(
            val role: String,
            val defaultPortfolio: Boolean?,
            val defaultWatchlist: Boolean?,
            val symbols: List<String>?,
        )
    }

    fun resolve(userRoles: List<String>, tenantPreferences: Document?): TenantBootstrapDecision {
        val platformRole = pickBootstrapPlatformRole(userRoles)
        if (platformRole == null) {
            log.debug("[tenant-bootstrap] no viewer/operator/advisor role; skip provision userRoles={}", userRoles)
            return TenantBootstrapDecision(false, null)
        }
        val policy = effectiveTenantBootstrapPolicy(tenantPreferences)
        val flags = resolveBootstrapFlagsForRole(policy, platformRole)
        if (!flags.defaultPortfolio) {
            return TenantBootstrapDecision(false, null)
        }
        val tenantTemplate = normalizeWatchlistSeedSymbolsFromPreferences(tenantPreferences)
        val symbols =
            resolveWatchlistSeedSymbols(
                flags.defaultWatchlist,
                flags.overrideSymbols,
                tenantTemplate,
            )
        return TenantBootstrapDecision(true, symbols)
    }

    private fun pickBootstrapPlatformRole(userRoles: List<String>): BootstrapPlatformRole? {
        val set = userRoles.map { it.trim().lowercase() }.toSet()
        if (set.contains("advisor")) {
            return BootstrapPlatformRole.ADVISOR
        }
        if (set.contains("operator")) {
            return BootstrapPlatformRole.OPERATOR
        }
        if (set.contains("viewer")) {
            return BootstrapPlatformRole.VIEWER
        }
        return null
    }

    private fun effectiveTenantBootstrapPolicy(tp: Document?): ParsedPolicy {
        if (tp == null) {
            return parsedDefaultStandard()
        }
        val embedded = tp["bootstrap_policy"]
        if (embedded is Document) {
            return try {
                parseBootstrapPolicyDoc(embedded)
            } catch (e: Exception) {
                log.warn("[tenant-bootstrap] invalid bootstrap_policy; using defaults: {}", e.message)
                parsedDefaultStandard()
            }
        }
        when (val legacy = tp["bootstrap_default_portfolio_watchlist"]) {
            false ->
                return ParsedPolicy(defaultPortfolioAllFalse, defaultWatchlistAllFalse, emptyList())
            true ->
                return ParsedPolicy(
                    mapOf(
                        BootstrapPlatformRole.VIEWER to true,
                        BootstrapPlatformRole.OPERATOR to true,
                        BootstrapPlatformRole.ADVISOR to true,
                    ),
                    mapOf(
                        BootstrapPlatformRole.VIEWER to true,
                        BootstrapPlatformRole.OPERATOR to true,
                        BootstrapPlatformRole.ADVISOR to true,
                    ),
                    emptyList(),
                )
        }
        return parsedDefaultStandard()
    }

    private fun parsedDefaultStandard(): ParsedPolicy =
        ParsedPolicy(defaultPortfolioStandard, defaultWatchlistStandard, emptyList())

    private fun parseBootstrapPolicyDoc(doc: Document): ParsedPolicy {
        val dp = readRoleBoolMap(doc["defaultPortfolio"], "defaultPortfolio")
        val dw = readRoleBoolMap(doc["defaultWatchlist"], "defaultWatchlist")
        val overridesRaw = doc["overrides"]
        val overrides = mutableListOf<ParsedPolicy.Override>()
        if (overridesRaw is List<*>) {
            for (entry in overridesRaw) {
                if (entry !is Document) {
                    continue
                }
                val role = entry.getString("role")?.trim() ?: continue
                val o =
                    ParsedPolicy.Override(
                        role = role,
                        defaultPortfolio = entry["defaultPortfolio"] as? Boolean,
                        defaultWatchlist = entry["defaultWatchlist"] as? Boolean,
                        symbols =
                            (entry["symbols"] as? List<*>)?.mapNotNull { sym ->
                                sym?.toString()?.trim()?.uppercase()?.takeIf { it.isNotEmpty() }
                            },
                    )
                overrides.add(o)
            }
        }
        return ParsedPolicy(dp, dw, overrides)
    }

    private fun readRoleBoolMap(raw: Any?, label: String): Map<BootstrapPlatformRole, Boolean> {
        if (raw !is Document) {
            throw IllegalArgumentException("bootstrapPolicy.$label must be an object")
        }
        fun boolFor(key: String): Boolean {
            val v = raw[key]
            if (v !is Boolean) {
                throw IllegalArgumentException("bootstrapPolicy.$label.$key must be boolean")
            }
            return v
        }
        return mapOf(
            BootstrapPlatformRole.VIEWER to boolFor("viewer"),
            BootstrapPlatformRole.OPERATOR to boolFor("operator"),
            BootstrapPlatformRole.ADVISOR to boolFor("advisor"),
        )
    }

    private data class BootstrapFlags(
        val defaultPortfolio: Boolean,
        val defaultWatchlist: Boolean,
        val overrideSymbols: List<String>?,
    )

    private fun resolveBootstrapFlagsForRole(
        policy: ParsedPolicy,
        platformRole: BootstrapPlatformRole,
    ): BootstrapFlags {
        var defaultPortfolio = policy.defaultPortfolio[platformRole]!!
        var defaultWatchlist = policy.defaultWatchlist[platformRole]!!
        var overrideSymbols: List<String>? = null
        val pr = platformRole.name.lowercase()
        for (o in policy.overrides) {
            if (o.role.trim().lowercase() == pr) {
                o.defaultPortfolio?.let { defaultPortfolio = it }
                o.defaultWatchlist?.let { defaultWatchlist = it }
                if (!o.symbols.isNullOrEmpty()) {
                    overrideSymbols = o.symbols
                }
            }
        }
        return BootstrapFlags(defaultPortfolio, defaultWatchlist, overrideSymbols)
    }

    private fun normalizeWatchlistSeedSymbolsFromPreferences(tp: Document?): List<String>? {
        if (tp == null) {
            return null
        }
        val raw = tp["watchlist_seed_symbols"]
        if (raw !is List<*>) {
            return null
        }
        val out =
            raw.mapNotNull { it?.toString()?.trim()?.uppercase()?.takeIf { s -> s.isNotEmpty() } }
        return out.takeIf { it.isNotEmpty() }
    }

    private fun resolveWatchlistSeedSymbols(
        defaultWatchlist: Boolean,
        overrideSymbols: List<String>?,
        tenantTemplateSymbols: List<String>?,
    ): List<String>? {
        if (!defaultWatchlist) {
            return null
        }
        if (!overrideSymbols.isNullOrEmpty()) {
            return overrideSymbols
        }
        if (!tenantTemplateSymbols.isNullOrEmpty()) {
            return tenantTemplateSymbols
        }
        return deskDefaults
    }
}
