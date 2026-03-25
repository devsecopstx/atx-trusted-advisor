> **Backlog summary:** [PLAN.md § NL and strategy preflight](../../PLAN.md#nl-and-strategy-preflight-backlog-themes). This document is the **deep spec** (examples, snippets, UX copy).

# xchat-end-user-response formatting
Best way to apply formatting for end user (production-ready, minimal code)

Use ReactMarkdown + remarkGfm + rehype plugins (as shown above) — this handles 95% of Grok’s output perfectly:
Bold, italics, headers, lists, tables, code blocks
Links auto-converted
GFM tables (very common in Grok financial/market summaries)

Syntax highlighting for any ``` code fences (Prism + oneDark is clean & dark-mode ready)
Quick pre-cleanup (the cleanedContent memo):
Fixes double bold escapes Grok sometimes produces
Turns Key: value lines into ### headers (makes market summaries pop)
Collapses excessive newlines

UI wrapper — shadcn Card + prose classes gives beautiful typography without fighting tailwind.
Implementation summary

New ToolUsage model in Prisma
recordToolUsage helper — call it on every tool success/error
Hook into your tool executor (e.g. handleToolCall wrapper)
Admin page with real-time stats + recent calls table (Server Component)
Zero perf hit — async fire-and-forget writes
Indexes on user/tool/time for fast queries



## xchat-agent-rules
Bottom line
Do not let the agent figure out what tools to use.
- rule check to ensure
Your current setup (persona tools + forced hosted baseline + strong instructions) is already the right choice — just keep it and never remove the explicit declaration step.
## xchat-agent-guardrails
Key guardrail features

Blocks save when no tools + hosted search disabled (prevents dangerous empty-tool personas)
Shows clear warning with risks explained (hallucination, API errors, bad financial data)
One-click "Enable Hosted Search" button
"Save Anyway" escape hatch for rare non-tool use cases (with red styling)
Always-visible info banner reminding admins why tools matter
Uses shadcn/ui for clean, consistent look
Zod schema + react-hook-form for validation safety

## verify this is complete
## Summary of what to do next (KISS edition)

Create single SESSION_TOOL_INSTRUCTIONS constant with conditional wording for both hosted and custom tools.
Rename & simplify user prompt augmentation to one short function (used by both ask and batch).
Lock system prompt order: persona → RAG → snapshot → instructions (no more separate if-blocks).
Keep mergeXchatHostedToolBaseline — it guarantees web/x_search are always there.
Do not try to unify ask and batch execution path — batch is intentionally single-turn/async.


## How to Add Prompts for the User (Implementation Rules)
When any of these are missing, respond immediately with a question instead of calling Grok:

Append this once after RAG + snapshot (conditional text inside handles presence).


One user prompt helper (rename + simplify)diff-function buildBatchUserPromptAugmentation(...)
+function buildUserPromptWithMetadata(message: string, persona: Persona): string {
  const collections = resolveCollectionUnion(persona);
  const toolNames = getEffectiveToolNames(persona);


return ${message}\n\n[Metadata]\nCollections: ${collections.join(', ')}\nTools: ${toolNames.join(', ')};


return ${message}\n\n---\nAvailable collections: ${collections.join(', ')}\nAvailable tools: ${toolNames.join(', ')};
}

## watchlist nl example

Missing FieldExample Server Response (one question only)default_account"Which account should I use as default?
1. IRA-Edge
2. Individual-TOD
3. Brokerage"default_portfolio"Which portfolio do you want to analyze?
1. Main
2. Growth
3. Income"outlook"What's your outlook on the market / symbol?
1. Bullish
2. Neutral
3. Bearish"risk"What's your risk tolerance?
1. Low (conservative)
2. Medium
3. High"watchlist (add item)If user says "add NVDA to my watchlist" → parse it, add to TEAM_XAI, then reply: "Added NVDA to watchlist. Anything else?"


Key Rules for Good UX

Always ask one question at a time
Use numbered choices when possible (user can reply with "1" or "bullish")
Support natural language fallback ("add NVDA to my watchlist" → detect intent, add it, confirm)
Persist every answer in TEAM_XAI collection (as structured fields + chat history)
Only call Grok when all required inputs are filled

Summary of the Design

Server always checks for missing inputs before calling Grok.
Returns a structured prompt_question response when something is missing.
Handles natural language commands (like “add NVDA…”) immediately.
Only calls Grok when all required inputs are present.
Everything is persisted in the single TEAM_XAI defined  collection.


when using atx-options nl prompts

example backend servivces to ensure user prompt is server-side processed.

// apps/web/components/xstrategy-builder/StrategyChoiceFlow.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChoiceOption {
  id: string;
  label: string;
  description: string;
  icon?: React.ReactNode;
}

interface StrategyStep {
  id: string;
  question: string;
  options: ChoiceOption[];
  multiSelect?: boolean;
}

const STRATEGY_STEPS: StrategyStep[] = [
  {
    id: 'outlook',
    question: 'What is your expected outlook for TSLA over the next 1-3 months?',
    options: [
      { id: 'bullish', label: 'Bullish (I expect it to go up)', description: 'Looking for upside exposure or income on gains' },
      { id: 'neutral', label: 'Neutral (sideways/flat)', description: 'Prefer income generation with limited directional risk' },
      { id: 'bearish', label: 'Bearish (I expect it to go down)', description: 'Want downside protection or bearish exposure' },
    ],
  },
  {
    id: 'risk_tolerance',
    question: 'What is your risk tolerance for this position?',
    options: [
      { id: 'low', label: 'Low', description: 'Capital preservation is priority — limited downside acceptable' },
      { id: 'medium', label: 'Medium', description: 'Balanced — comfortable with moderate risk for better yield' },
      { id: 'high', label: 'High', description: 'Aggressive — willing to take larger risk for higher potential reward' },
    ],
  },
  {
    id: 'strategy_preference',
    question: 'Which strategy direction interests you most?',
    options: [
      { id: 'income', label: 'Income Generation', description: 'Sell premium (covered calls, cash-secured puts)' },
      { id: 'protection', label: 'Downside Protection', description: 'Protective puts, collars, or hedges' },
      { id: 'leverage', label: 'Leveraged Upside', description: 'Long calls or spreads for directional conviction' },
      { id: 'neutral', label: 'Volatility/Neutral', description: 'Straddles, strangles, iron condors' },
    ],
  },
];

export function StrategyChoiceFlow() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string | string[]>>({});

  const step = STRATEGY_STEPS[currentStep];
  const isLastStep = currentStep === STRATEGY_STEPS.length - 1;

  const handleSelect = (value: string | string[]) => {
    setSelections((prev) => ({ ...prev, [step.id]: value }));
  };

  const canProceed = !!selections[step.id];

  const handleNext = () => {
    if (canProceed && !isLastStep) {
      setCurrentStep((prev) => prev + 1);
    } else if (canProceed && isLastStep) {
      // Submit to backend or generate final prompt
      console.log('Final selections:', selections);
      // Example: build prompt for Grok/xAI
      const prompt = buildFinalStrategyPrompt(selections);
      // send to /api/xstrategy/builder or display
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold">Build Your Options Strategy</h2>
          <div className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {STRATEGY_STEPS.length}
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{ width: `${((currentStep + 1) / STRATEGY_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-xl">{step.question}</CardTitle>
          <CardDescription>Select one option below</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={selections[step.id] as string}
            onValueChange={handleSelect}
            className="space-y-4"
          >
            {step.options.map((option) => (
              <div
                key={option.id}
                className={cn(
                  'flex items-start space-x-3 border rounded-lg p-4 cursor-pointer transition-colors',
                  selections[step.id] === option.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                )}
                onClick={() => handleSelect(option.id)}
              >
                <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={option.id} className="font-medium text-base">
                    {option.label}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Button onClick={handleNext} disabled={!canProceed}>
          {isLastStep ? (
            <>
              Generate Strategy
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Optional helper to build final prompt for Grok/xAI
function buildFinalStrategyPrompt(selections: Record<string, string | string[]>) {
  return `
You are an expert options strategist. Based on the user's selections:

Outlook: ${selections.outlook}
Risk Tolerance: ${selections.risk_tolerance}
Preferred Direction: ${selections.strategy_preference}

Build a tailored options strategy for TSLA using the xStrategyBuilder format.
Include:
- Recommended trade(s) with strikes, expiration, quantity
- Risk/reward profile
- Breakeven points
- Max profit/loss
- Greeks summary
- Why this fits their outlook/risk profile
- Alternatives if any

Keep response structured, concise, and actionable.
`;
}

Quick integration notes

Put this in your xstrategybuilder page or wizard flow (apps/web/app/find-profits/xstrategy/page.tsx)
On final step → buildFinalStrategyPrompt(selections) → send to your existing /api/xchat/ask or dedicated /api/xstrategy/generate endpoint
For multi-select steps (if needed later): change RadioGroup → Checkbox + array handling
Style matches shadcn/ui — clean, professional, mobile-friendly
Progress bar + back/next gives guided, non-overwhelming UX
Final prompt is ready-to-use for Grok — structured input → structured output

This gives users a clean, choice-driven interface that feels like a strategy wizard while feeding Grok high-signal prompts. Drop in, test, and iterate. No fluff.
