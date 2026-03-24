# atxdesign-review-reliability Checklist

## Validation Checklist

- [ ] Batch-first route tests pass for all non-interactive flows
- [ ] Budget guardrails block runaway sessions
- [ ] Tool fanout stays within defined limits
- [ ] Fallback/degraded modes preserve safe behavior
- [ ] SLOs are met under load and failure drills
