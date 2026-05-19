# TSLA options narrative templates (reference)

Prompt-style templates for covered calls, CSPs, wheel, LEAP, and portfolio allocation scenarios. **Not** a Cursor skill — invoke in conversation or embed in persona copy as needed.

Moved from `.cursor/skills/skill-xstrategy/options-core.md` (2026-05-19).

---

# TSLA Covered Call - Moderate Bi-Weekly Setup
Current TSLA price: [insert current price]
Portfolio TSLA shares: [insert count]
Cost basis: [insert avg cost/share]

Objective: 5-10% annualized premium yield, reinvest all into more TSLA shares toward $10M by 2030

Generate:
- Recommended strike: 5-10% OTM, 10-21 day expiration
- Expected premium range (using current IV)
- Per-cycle yield % and annualized projection (26 cycles)
- Max upside participation before assignment
- Roll strategy if approaching ITM
- 80% profit rule trigger price for early buyback
- Allocation recommendation: 20-30% of holdings

# TSLA Covered Call - Aggressive Weekly Setup
Current TSLA price: [insert]
Portfolio shares exposed: 50%+

Objective: Maximize premium collection (target 15-40% annualized if no assignment), full reinvestment

Generate:
- Strike: 3-5% OTM, 5-7 day expiration
- Expected premium and weekly yield %
- Annualized return assuming 80-90% expiration worthless rate
- Risk of frequent assignment / being called away
- Immediate post-assignment plan: sell OTM CSP to restart wheel
- 80% rule: exact buyback price when premium decays 80%
- Capital efficiency vs upside sacrifice analysis

# TSLA Cash-Secured Put - Moderate Entry
Available cash for CSP: [insert amount]
Desired max buy price if assigned: [insert target entry]

Objective: Collect premium, acquire shares 5-15% below current on dips

Generate:
- Recommended strike: -5% to -10% OTM
- Expiration: 30-45 days
- Expected premium yield %
- Breakeven price after premium
- Probability of assignment (delta approx)
- If assigned: immediate covered call plan on new shares
- Cash efficiency: how many contracts fit available cash
- Reinvestment: premium → LEAP calls or more shares?

# TSLA Cash-Secured Put - Aggressive Tight
Current TSLA: [insert]
Cash available: [insert]

Objective: Higher premium, accept higher assignment probability for faster compounding

Generate:
- Strike: -2% to -5% OTM, weekly or bi-weekly
- Premium target and annualized yield
- Breakeven and max downside protection
- Assignment likelihood (delta 0.30-0.50 range)
- Post-assignment: sell OTM CC immediately
- Roll up/out strategy if TSLA drops sharply
- 80% profit capture rule application

# TSLA Wheel - Moderate Monthly Cycle
Starting position: cash or shares?

Generate complete cycle plan:
Phase A: Sell 5-10% OTM CSP → collect premium or get assigned
Phase B: If assigned → sell 5-10% OTM CC bi-weekly
Phase C: If called away → return to CSP at desired re-entry
- Target annualized return from premiums
- Reinvestment rule: 100% premiums → additional TSLA shares
- Risk controls: max drawdown tolerance, stop/roll triggers
- Expected share accumulation rate toward $10M goal

# TSLA Wheel - Aggressive Weekly
Goal: Maximize cycles, premium velocity, share compounding

Generate:
- CSP phase: 2-5% OTM weekly
- CC phase: 3-5% OTM weekly on assigned shares
- Target premium % per cycle
- Projected annualized return range
- Assignment / call-away frequency estimate
- Capital recycling speed to $10M portfolio
- 80% rule triggers for both legs
- Defense allocation if volatility spikes

# TSLA LEAP Call + Margin - Moderate/Aggressive
Current TSLA: [insert]
Portfolio cash/margin capacity: [insert]

Objective: Leveraged upside exposure 2027-2028 expiry

Generate:
- Recommended strike: 20-50% OTM deep
- Delta/gamma profile
- Cost vs margin borrow at 7-9%
- Breakeven and max loss scenarios
- Target return if TSLA doubles/triples by 2028
- Allocation: 30% moderate / 50%+ aggressive
- Exit/roll plan at 100-200% gain
- Risk: time decay vs TSLA compounding

# TSLA Options - 80% Profit Rule Execution
Sold premium: [insert $ per contract]
Current option price: [insert]

Generate:
- 80% profit target price: exact buyback level
- Time remaining vs theta decay curve estimate
- When to set alert / auto-close order
- Pros/cons of early close vs letting expire
- Application to both CC and CSP legs
- Impact on annualized yield when capturing 80% frequently

# TSLA Covered Call Assignment Recovery
Called away at strike: [insert]
Cash received: [insert]

Generate immediate next steps:
- Desired re-entry price for new shares
- Sell CSP at/near that strike
- Premium expected vs time to fill
- Wheel restart timeline
- Net capital gain/loss from cycle
- Long-term compounding effect toward $10M

# TSLA Options Portfolio - Balanced $10M Plan by 2030
Current TSLA shares: [insert]
Current value: [insert]
Annualized stock appreciation assumption: [15-30%?]

Allocate across:
- Covered calls: 20-50% of shares
- Cash-secured puts: 20-40% of cash
- LEAP calls: 20-40% leverage
- Defense proxies: 5-10% if needed

Generate:
- Target annual premium yield range
- Compounded share growth projection
- Moderate vs aggressive scenario comparison
- Key risk metrics: max drawdown, volatility exposure
- Rebalance triggers every 6 months
