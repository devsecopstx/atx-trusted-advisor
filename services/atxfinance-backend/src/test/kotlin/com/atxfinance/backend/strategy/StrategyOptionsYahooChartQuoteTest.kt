package com.atxfinance.backend.strategy

import com.atxfinance.backend.config.AtxfinanceProperties
import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock
import org.springframework.beans.factory.ObjectProvider
import org.springframework.data.redis.core.StringRedisTemplate

class StrategyOptionsYahooChartQuoteTest {
  @Suppress("UNCHECKED_CAST")
  private fun emptyRedisProvider(): ObjectProvider<StringRedisTemplate> {
    val p = mock(ObjectProvider::class.java) as ObjectProvider<StringRedisTemplate>
    `when`(p.ifAvailable).thenReturn(null)
    return p
  }

  @Suppress("UNCHECKED_CAST")
  private fun emptyPropsProvider(): ObjectProvider<AtxfinanceProperties> {
    val p = mock(ObjectProvider::class.java) as ObjectProvider<AtxfinanceProperties>
    `when`(p.ifAvailable).thenReturn(null)
    return p
  }

  @Test
  fun `fetchEquityQuoteFromChart returns live TSLA price`() {
    val client =
      StrategyOptionsYahooClient(
        ObjectMapper(),
        emptyRedisProvider(),
        emptyPropsProvider(),
      )
    val q = client.fetchEquityQuoteFromChart("TSLA")
    assertNotNull(q)
    val price = (q!!["regularMarketPrice"] as? Number)?.toDouble()
    assertNotNull(price)
    assertTrue(price!! > 50.0)
  }
}
