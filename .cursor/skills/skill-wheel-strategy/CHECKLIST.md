# skill-wheel-strategy Checklist

Use with `SKILL.md`. Check each row before shipping advice.

## Inputs (core setup)
- [ ] Phase 1: sell cash-secured puts to seek discounted assignment.
- [ ] Phase 2: after assignment, sell covered calls against shares.
- [ ] Repeat cycle with premium reinvestment and position sizing discipline.

## Preferences / guardrails
- [ ] Preserve cash collateral requirements in put phase.
- [ ] Preserve share inventory checks in covered-call phase.
- [ ] Include transition rules between phases.

## Output format
- [ ] Current phase assessment.
- [ ] Proposed next trade in cycle.
- [ ] Transition triggers (assign/expire/roll).
- [ ] Risk and capital usage summary.
