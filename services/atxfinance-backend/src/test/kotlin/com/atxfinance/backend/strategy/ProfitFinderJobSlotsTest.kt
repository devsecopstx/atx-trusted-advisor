package com.atxfinance.backend.strategy

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class ProfitFinderJobSlotsTest {
    @Test
    fun `profit-finder job uses mode focus symbol slot order`() {
        val order = StrategyJobService.slotOrderFor(StrategyJobService.JOB_TYPE_PROFIT_FINDER)
        assertEquals(listOf("mode", "focus", "symbol"), order)
    }

    @Test
    fun `slot collector keeps legacy slot order`() {
        val order = StrategyJobService.slotOrderFor(StrategyJobService.JOB_TYPE_SLOT_COLLECTOR)
        assertEquals(listOf("outlook", "risk", "horizon", "underlying", "capital"), order)
    }

    @Test
    fun `profit-finder job type constant matches API contract`() {
        assertEquals("profit-finder", StrategyJobService.JOB_TYPE_PROFIT_FINDER)
    }
}