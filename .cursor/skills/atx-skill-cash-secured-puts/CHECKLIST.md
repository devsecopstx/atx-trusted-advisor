# atx-skill-cash-secured-puts — checklist

Use with `SKILL.md`. Check each row before shipping advice.

## Inputs (core setup)
- [ ] Sell puts only with full collateral reserved.
- [ ] Typical strike selection: 8-12% OTM for aggressive premium capture.
- [ ] Use 30-60 DTE windows unless user asks for shorter duration.

## Preferences / guardrails
- [ ] No uncovered short puts.
- [ ] Always state cash requirement: strike x 100 x contracts.
- [ ] Include assignment plan (accept shares vs roll).

## Output format
- [ ] Strike/expiration candidate.
- [ ] Collateral and premium estimate.
- [ ] Breakeven and assignment outcome.
- [ ] Roll criteria and risk summary.
