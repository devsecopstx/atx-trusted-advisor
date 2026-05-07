package com.atxfinance.backend.portfolio

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId

/**
 * Approximates **US equities regular session** (NYSE-style **09:30–16:00 America/New_York**, Mon–Fri).
 * Does **not** model exchange holidays — holidays are treated as **closed** for TTL policy only when weekend logic applies;
 * for a holiday weekday, time-of-day logic may still classify as open (conservative shorter TTL would require a calendar feed).
 */
object UsEquitiesRegularSession {
    private val ET: ZoneId = ZoneId.of("America/New_York")
    private val OPEN: LocalTime = LocalTime.of(9, 30)
    private val CLOSE: LocalTime = LocalTime.of(16, 0)

    fun isRegularSessionLikelyOpen(now: Instant): Boolean {
        val zdt = now.atZone(ET)
        val dow = zdt.dayOfWeek
        if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) {
            return false
        }
        val t = zdt.toLocalTime()
        return !t.isBefore(OPEN) && t.isBefore(CLOSE)
    }
}
