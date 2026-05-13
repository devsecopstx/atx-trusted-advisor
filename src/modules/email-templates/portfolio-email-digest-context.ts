import { ObjectId } from "mongodb";

import { caughtErrorMessage } from "@/lib/caught-error";
import { chatWithXai } from "@/lib/xai";
import {
    adminGetPortfolioById,
    adminListPortfolioAlerts,
    listPortfolioAccounts,
    listPortfolioPositionsByAccount
} from "@/modules/core-admin/repository";
import type {
    EmailDigestCadence,
    EmailTemplateRenderContext
} from "@/modules/email-templates/types";

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const PCT_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
  signDisplay: "always"
});

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return USD_FORMATTER.format(value);
}

function formatPct(fraction: number): string {
  if (!Number.isFinite(fraction)) {
    return "—";
  }
  return PCT_FORMATTER.format(fraction);
}

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function periodWindow(cadence: EmailDigestCadence, now: Date): { start: Date; end: Date } {
  const end = now;
  const start = new Date(end);
  if (cadence === "weekly") {
    start.setUTCDate(start.getUTCDate() - 7);
  } else {
    start.setUTCDate(start.getUTCDate() - 1);
  }
  return { start, end };
}

/**
 * Build the fixed render context. Live numbers come from `tenant_portfolio` + `portfolio_positions`;
 * narrative is generated via xAI when `XAI_API_KEY` is set, else falls back to a deterministic stub
 * so the digest still ships.
 */
export async function buildPortfolioEmailDigestContext(input: {
  portfolioId: ObjectId | string;
  cadence: EmailDigestCadence;
  /** Override the "now" timestamp — useful in tests. */
  now?: Date;
}): Promise<EmailTemplateRenderContext | null> {
  const portfolioIdHex =
    input.portfolioId instanceof ObjectId
      ? input.portfolioId.toHexString()
      : input.portfolioId;
  if (!ObjectId.isValid(portfolioIdHex)) {
    return null;
  }
  const portfolio = await adminGetPortfolioById(portfolioIdHex);
  if (!portfolio?._id) {
    return null;
  }

  const now = input.now ?? new Date();
  const { start, end } = periodWindow(input.cadence, now);
  const userIdRaw = portfolio.userId;
  const userIdString =
    userIdRaw instanceof ObjectId ? userIdRaw.toHexString() : String(userIdRaw);

  const accounts = await listPortfolioAccounts({
    userId: userIdString,
    portfolioId: portfolioIdHex
  });
  const accountIds = accounts.flatMap((a) => (a._id ? [a._id] : []));
  const positions = accountIds.length
    ? await listPortfolioPositionsByAccount({
        userId: userIdString,
        portfolioId: portfolioIdHex,
        accountIds,
        tenantId: portfolio.tenantId?.toHexString()
      })
    : [];

  let totalValue = 0;
  for (const a of accounts) {
    if (typeof a.cashBalance === "number" && Number.isFinite(a.cashBalance)) {
      totalValue += a.cashBalance;
    }
  }
  const positionRows = positions
    .map((p) => {
      const mkt = (p.qty ?? 0) * (p.avgCost ?? 0);
      totalValue += mkt;
      return {
        symbol: p.symbol,
        qty: p.qty ?? 0,
        marketValue: formatUsd(mkt)
      };
    })
    .sort((a, b) => Math.abs(b.qty) - Math.abs(a.qty))
    .slice(0, 10);

  const alerts = await adminListPortfolioAlerts(portfolioIdHex);
  const events = alerts
    .filter((a) => a.createdAt >= start && a.createdAt <= end)
    .slice(0, 25)
    .map((a) => ({
      title: a.title,
      body: a.body ?? "",
      symbol: a.symbol ?? ""
    }));

  const topMovers: ReadonlyArray<{ symbol: string; changePct: string }> = [];

  const narrative = await generateNarrative({
    portfolioName: portfolio.name,
    cadence: input.cadence,
    totalValueUsd: totalValue,
    eventCount: events.length,
    positionsCount: positionRows.length
  });

  return {
    portfolio: { name: portfolio.name, id: portfolio._id.toHexString() },
    period: { cadence: input.cadence, start: isoDateOnly(start), end: isoDateOnly(end) },
    totalValue: formatUsd(totalValue),
    weekChange: formatPct(0),
    dayChange: formatPct(0),
    events,
    positions: positionRows,
    topMovers,
    narrative,
    hasEvents: events.length > 0,
    hasPositions: positionRows.length > 0,
    hasTopMovers: topMovers.length > 0
  };
}

const NARRATIVE_SYSTEM_PROMPT =
  "You are a senior portfolio advisor writing a short desk note. " +
  "Write 2-3 short paragraphs in plain English, no bullet lists, no headings, no markdown. " +
  "Stay factual to the inputs. Mention outlook + top risks. Never quote prices or invent numbers. " +
  "End with a brief line: 'Not financial advice.'";

async function generateNarrative(input: {
  portfolioName: string;
  cadence: EmailDigestCadence;
  totalValueUsd: number;
  eventCount: number;
  positionsCount: number;
}): Promise<string> {
  if (!process.env.XAI_API_KEY?.trim()) {
    return fallbackNarrative(input);
  }
  try {
    const result = await chatWithXai({
      messages: [
        { role: "system", content: NARRATIVE_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Portfolio: ${input.portfolioName}`,
            `Cadence: ${input.cadence}`,
            `Total value: ${formatUsd(input.totalValueUsd)}`,
            `Events in window: ${input.eventCount}`,
            `Open positions: ${input.positionsCount}`,
            "",
            "Write the desk note now."
          ].join("\n")
        }
      ],
      temperature: 0.3
    });
    const out = result.outputText.trim();
    return out.length > 0 ? out : fallbackNarrative(input);
  } catch (error) {
    console.warn("[email-templates] narrative xAI fallback", {
      reason: caughtErrorMessage(error)
    });
    return fallbackNarrative(input);
  }
}

function fallbackNarrative(input: {
  portfolioName: string;
  cadence: EmailDigestCadence;
  eventCount: number;
  positionsCount: number;
}): string {
  return [
    `${input.portfolioName} ${input.cadence} desk note.`,
    `${input.positionsCount} open positions; ${input.eventCount} alert${input.eventCount === 1 ? "" : "s"} in window.`,
    "Review concentrations and roll/exit candidates with your advisor before acting.",
    "Not financial advice."
  ].join(" ");
}
