package com.atxfinance.backend.portfolio

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.time.ZoneId

class UsEquitiesRegularSessionTest {
    @Test
    fun `saturday is closed`() {
        val sat =
            LocalDate.of(2026, 5, 9)
                .atTime(12, 0)
                .atZone(ZoneId.of("America/New_York"))
                .toInstant()
        assertFalse(UsEquitiesRegularSession.isRegularSessionLikelyOpen(sat))
    }

    @Test
    fun `weekday noon ET is open`() {
        val wed =
            LocalDate.of(2026, 5, 6)
                .atTime(12, 0)
                .atZone(ZoneId.of("America/New_York"))
                .toInstant()
        assertTrue(UsEquitiesRegularSession.isRegularSessionLikelyOpen(wed))
    }

    @Test
    fun `weekday before open is closed`() {
        val wed =
            LocalDate.of(2026, 5, 6)
                .atTime(9, 0)
                .atZone(ZoneId.of("America/New_York"))
                .toInstant()
        assertFalse(UsEquitiesRegularSession.isRegularSessionLikelyOpen(wed))
    }

    @Test
    fun `exact close is closed`() {
        val wed =
            LocalDate.of(2026, 5, 6)
                .atTime(16, 0)
                .atZone(ZoneId.of("America/New_York"))
                .toInstant()
        assertFalse(UsEquitiesRegularSession.isRegularSessionLikelyOpen(wed))
    }
}
