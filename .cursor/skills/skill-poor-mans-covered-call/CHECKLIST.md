# skill-poor-mans-covered-call — checklist

Use with `SKILL.md`. Check each row before shipping advice.

## Inputs (core setup)
- [ ] Long leg: deep ITM, longer-dated call (often LEAP).
- [ ] Short leg: nearer-term OTM call sold repeatedly for income.
- [ ] Position behaves like covered call with lower capital than shares.

## Preferences / guardrails
- [ ] Track delta exposure of long leg.
- [ ] Define max loss (debit paid) and upside constraints.
- [ ] Include early assignment handling on short leg.

## Output format
- [ ] Long-leg candidate and rationale.
- [ ] Short-leg overlay candidate.
- [ ] Net debit, breakeven, and risk.
- [ ] Roll/repair plan.
