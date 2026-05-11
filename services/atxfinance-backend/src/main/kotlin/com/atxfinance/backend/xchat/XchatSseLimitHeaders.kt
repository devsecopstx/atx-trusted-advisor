package com.atxfinance.backend.xchat

import org.springframework.http.HttpHeaders

object XchatSseLimitHeaders {
    fun apply(headers: HttpHeaders, result: XchatUsageLimitResult, retryAfterSeconds: Int? = null) {
        result.remainingMinute?.let { headers.set("x-xchat-limit-remaining-minute", it.coerceAtLeast(0).toString()) }
        result.remainingHour?.let { headers.set("x-xchat-limit-remaining-hour", it.coerceAtLeast(0).toString()) }
        result.remainingDay?.let { headers.set("x-xchat-limit-remaining-day", it.coerceAtLeast(0).toString()) }
        result.hourlyLimit?.let { headers.set("x-xchat-limit-hourly", it.coerceAtLeast(0).toString()) }
        result.dailyLimit?.let { headers.set("x-xchat-limit-daily", it.coerceAtLeast(0).toString()) }
        val retry = retryAfterSeconds ?: result.retryAfterSeconds
        if (retry != null && retry > 0) {
            headers.set(HttpHeaders.RETRY_AFTER, retry.coerceAtLeast(1).toString())
        }
    }

    fun limitErrorMessage(code: XchatUsageLimitCode?): String =
        when (code) {
            "xchat_daily_limit_exceeded" ->
                "Daily prompt limit reached for your workspace (UTC calendar day). Your admin can raise caps under Tenant → Workspace limits, or compare plans."
            "xchat_hourly_limit_exceeded" ->
                "Hourly prompt limit reached (UTC clock hour). Wait for the top of the next hour or ask your admin to adjust workspace limits."
            else -> "Too many messages sent in a short window. Pause briefly and try again."
        }
}
