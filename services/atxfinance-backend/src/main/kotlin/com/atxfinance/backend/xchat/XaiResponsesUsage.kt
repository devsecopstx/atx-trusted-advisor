package com.atxfinance.backend.xchat

import com.fasterxml.jackson.databind.JsonNode

data class XchatXaiUsageSnapshot(
    val inputTokens: Int,
    val outputTokens: Int,
    val totalTokens: Int,
    val reasoningTokens: Int? = null,
    val cachedPromptTokens: Int? = null,
    val costUsdTicks: Int? = null,
)

object XaiResponsesUsage {
    fun extract(raw: JsonNode?): XchatXaiUsageSnapshot? {
        if (raw == null || raw.isNull) {
            return null
        }
        val usage = raw.path("usage")
        if (usage.isMissingNode || usage.isNull) {
            return null
        }
        val inputTokens = num(usage.path("prompt_tokens").asInt(usage.path("input_tokens").asInt(0)))
        val outputTokens = num(usage.path("completion_tokens").asInt(usage.path("output_tokens").asInt(0)))
        val reasoningTokens = num(usage.path("reasoning_tokens").asInt(0))
        val cachedPromptTokens =
            num(
                usage.path("cached_prompt_tokens").asInt(usage.path("cache_read_input_tokens").asInt(0)),
            )
        val costUsdTicks =
            num(
                usage.path("cost_in_usd_ticks").asInt(usage.path("costInUsdTicks").asInt(0)),
            )
        var totalTokens = num(usage.path("total_tokens").asInt(0))
        if (totalTokens == 0) {
            totalTokens = inputTokens + outputTokens + reasoningTokens
        }
        if (
            inputTokens == 0 &&
            outputTokens == 0 &&
            reasoningTokens == 0 &&
            totalTokens == 0 &&
            cachedPromptTokens == 0 &&
            costUsdTicks == 0
        ) {
            return null
        }
        return XchatXaiUsageSnapshot(
            inputTokens = inputTokens,
            outputTokens = outputTokens,
            totalTokens = totalTokens,
            reasoningTokens = reasoningTokens.takeIf { it > 0 },
            cachedPromptTokens = cachedPromptTokens.takeIf { it > 0 },
            costUsdTicks = costUsdTicks.takeIf { it > 0 },
        )
    }

    private fun num(value: Int): Int = if (value >= 0) value else 0
}
