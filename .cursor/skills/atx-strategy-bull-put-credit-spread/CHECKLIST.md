# atx-strategy-bull-put-credit-spread — checklist

Use with `SKILL.md`. Check each row before shipping advice.

## Inputs (core setup)
- [ ] Frequency understood: High
- [ ] Thesis aligned: Sell OTM put spreads on TSLA dips for defined-risk income; reinvest proceeds into TSLA.
- [ ] Risk profile acknowledged: Moderate (limited max loss)

## Preferences / guardrails
- [ ] Keep spread width aligned with defined max-loss limits.
- [ ] Require explicit invalidation and exit logic.
- [ ] Avoid overlapping spread clusters around key event dates.

## Output format
- [ ] Short/long strike proposal.
- [ ] Credit, max profit, max loss, breakeven.
- [ ] Management triggers.
- [ ] Risk summary.
