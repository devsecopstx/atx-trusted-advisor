# xDesign Review: Legacy Prompt + xf-legacy Inventory

Captured for migration/reference work between `xfinance` and `xfinance-strategy`.

## Scope

- Legacy/source app: `xfinance-strategy`
- Current app: `xfinance`
- Capture target:
  - all `use-example-prompts` style persona examples
  - default legacy persona behavior
  - `xf-legacy-*` branding assets currently in repo

## Source of truth (legacy prompt sets)

Primary source in strategy app:

- `apps/frontend/src/lib/chat-personas.ts`
  - `PERSONA_EXAMPLE_PROMPTS`
  - `DEFAULT_EXAMPLE_PROMPTS`
  - `getPersonaExamplePrompts()`

## Default legacy persona behavior

From strategy app:

- `apps/frontend/src/lib/chat-history.ts`
  - `DEFAULT_PERSONA = "finance-expert"`
  - legacy chat documents without `persona` are treated as `finance-expert`
- `apps/frontend/src/app/api/chat/route.ts`
  - request persona fallback resolves to `DEFAULT_PERSONA` when absent

## use-example-prompts capture (all groups)

### finance-expert

- **News & research**: `TSLA news today`, `NVDA earnings date`, `Fed rate decision`, `Defense sector outlook`, `S&P 500 outlook this week`
- **Quotes & market**: `TSLA price`, `AAPL quote`, `Market outlook`, `VIX level`, `SPY and QQQ today`
- **Portfolio**: `Show my portfolio`, `My holdings`, `Account balance`, `Top movers today`, `Portfolio allocation`
- **Watchlist**: `My watchlist`, `What am I watching?`, `Watchlist performance`, `Add TSLA to watchlist`
- **Covered calls & options**: `Covered call ideas`, `Should I BTC my call?`, `Roll my TSLA call`, `CC recommendations`, `Wheel strategy on NVDA`
- **Tasks & scan**: `Scheduled tasks`, `Run scanner now`, `When does scanner run?`, `Options positions check`, `Covered call scan results`

### medical-expert

- **Symptoms & conditions**: `What are symptoms of seasonal allergies?`, `How do I tell cold from flu?`, `When should I worry about a headache?`, `Signs of dehydration in adults`
- **Lifestyle & prevention**: `Best ways to improve sleep`, `Exercise for lower back pain`, `How to prevent the flu`, `When to see a doctor for fever`
- **Treatments & evidence**: `Latest research on vitamin D`, `Evidence on intermittent fasting`, `New treatments for migraines`, `OTC options for seasonal allergies`
- **General health**: `Normal blood pressure range`, `How often should I get a checkup?`, `Red flags for chest pain`, `Stress and sleep connection`

### legal-expert

- **Contracts & agreements**: `What makes a contract legally valid?`, `Can I break my lease early?`, `What is an NDA and when is it enforceable?`, `Liability in a service agreement`
- **Investing & SEC**: `SEC rules for options trading`, `What counts as insider trading?`, `Disclosure requirements for investors`, `Rule 144 and restricted stock`
- **Business & entity**: `LLC vs S-corp vs C-corp`, `When do I need to hire a lawyer?`, `Trademark vs copyright basics`, `Contract dispute next steps`
- **General**: `Statute of limitations by state`, `Small claims court process`, `Power of attorney types`, `Estate planning basics`

### tax-expert

- **Investments**: `How are stock gains taxed?`, `What is the wash sale rule?`, `Tax treatment of options trading`, `Roth vs 401k for 2026`, `Cost basis for inherited stock`
- **Deductions & filing**: `Itemized vs standard deduction 2026`, `Home office deduction rules`, `When are estimated taxes due?`, `1099-B and cost basis reporting`
- **Planning**: `Tax-loss harvesting basics`, `2026 capital gains rates`, `Backdoor Roth steps`, `When to amend a return`
- **Specific situations**: `Tax on covered call premium`, `Exercise vs sell option tax`, `Qualified dividend rates`, `State tax on investment income`

### trusted-advisor

- **Goals & strategy**: `Am I on track for $10M by 2030?`, `How do I balance risk and growth?`, `Review my overall strategy`, `Where should I focus next?`
- **Portfolio & execution**: `Show my portfolio`, `Covered call ideas for my holdings`, `Market outlook and my positions`, `Rebalancing suggestions`
- **Tax & legal**: `Tax implications of my recent trades`, `Estate planning basics`, `Do I need an LLC for my trading?`
- **Broader picture**: `Health and wealth connection`, `Insurance and emergency fund`, `Prioritize: pay down debt vs invest?`

## xf-legacy defaults captured (current repo assets)

Current `branding/` assets with `xf-legacy-` prefix:

- `branding/xf-legacy-broker.jpg`
- `branding/xf-legacy-import-broker.jpg`
- `branding/xf-legacy-optionbuilder.jpg`
- `branding/xf-legacy-schedule-task.jpg`
- `branding/xf-legacy-wheel-prompt.jpg`

## Notes for migration

- If these prompts are moved into `xfinance` runtime, keep a single source (likely persona seed/config docs) and avoid divergence from strategy app wording.
- If legacy assets are renamed or replaced, sync:
  - `branding/README.md`
  - `branding/atxfinance-brand-validation.md`
  - any docs/screenshots referencing old filenames.
