package com.atxfinance.backend.strategy

import org.springframework.stereotype.Service

/**
 * Quant desk Monte Carlo orchestration hook for strategy jobs typed [StrategyJobService.JOB_TYPE_MONTE_CARLO_RUN].
 * Book-level simulation runs on Next.js (`monte_carlo_tail_risk` tool) for live xChat/xOptions;
 * JVM [MonteCarloTailRiskEngine] backs recommendation rationale.
 */
@Service
class QuantSimulationService {
    fun isMonteCarloRunJob(jobType: String?): Boolean =
        jobType == StrategyJobService.JOB_TYPE_MONTE_CARLO_RUN
}
