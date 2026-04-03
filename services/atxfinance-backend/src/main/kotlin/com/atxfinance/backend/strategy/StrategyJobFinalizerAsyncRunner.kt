package com.atxfinance.backend.strategy

import com.atxfinance.backend.session.ResolvedSession
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Component

@Component
class StrategyJobFinalizerAsyncRunner(
    private val finalizer: StrategyJobFinalizerService,
) {
    @Async("strategyFinalizerExecutor")
    fun enqueue(session: ResolvedSession, jobId: String) {
        finalizer.runFinalize(session, jobId)
    }
}
