import {
    getPortfolioByIdForSessionUser,
    listPortfolioAccounts,
    listPortfoliosForSessionUser
} from "@/modules/core-admin/repository";

export type PortfolioHintResolution =
  | { ok: true; portfolioIdHex: string; portfolioName: string }
  | {
      ok: false;
      error: "ambiguous" | "not_found";
      candidates?: Array<{ portfolioIdHex: string; label: string }>;
    };

function normHint(raw: string | undefined): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/**
 * Resolve NL portfolio hints (nickname / account label) to an owned portfolio id.
 * Default: current workspace portfolio when valid, else default portfolio for the user.
 */
export async function resolvePortfolioHintFromNl(input: {
  userId: string;
  tenantId?: string;
  portfolioHint?: string;
  workspacePortfolioId?: string | null;
}): Promise<PortfolioHintResolution> {
  const portfolios = await listPortfoliosForSessionUser({
    userId: input.userId,
    tenantId: input.tenantId
  });

  const hint = normHint(input.portfolioHint);

  async function workspaceOrDefault(): Promise<PortfolioHintResolution> {
    const ws = input.workspacePortfolioId?.trim();
    if (ws) {
      const wsPf = await getPortfolioByIdForSessionUser({
        userId: input.userId,
        tenantId: input.tenantId,
        portfolioId: ws
      });
      if (wsPf?._id) {
        return { ok: true, portfolioIdHex: wsPf._id.toHexString(), portfolioName: wsPf.name };
      }
    }
    const def = portfolios.find((p) => p.isDefault) ?? portfolios[0];
    if (!def?._id) {
      return { ok: false, error: "not_found" };
    }
    return { ok: true, portfolioIdHex: def._id.toHexString(), portfolioName: def.name };
  }

  if (!hint) {
    return workspaceOrDefault();
  }

  const matches: Array<{ portfolioIdHex: string; label: string; portfolioName: string }> = [];

  for (const pf of portfolios) {
    if (!pf._id) {
      continue;
    }
    const pid = pf._id.toHexString();
    const pname = pf.name.trim().toLowerCase();
    if (pname.includes(hint) || hint.includes(pname)) {
      matches.push({
        portfolioIdHex: pid,
        portfolioName: pf.name,
        label: `Portfolio “${pf.name}”`
      });
      continue;
    }
    const accounts = await listPortfolioAccounts({
      userId: input.userId,
      tenantId: input.tenantId,
      portfolioId: pid
    });
    for (const a of accounts) {
      const an = (a.name ?? "").trim().toLowerCase();
      if (!an) {
        continue;
      }
      if (an.includes(hint) || hint.includes(an)) {
        matches.push({
          portfolioIdHex: pid,
          portfolioName: pf.name,
          label: `Account “${a.name}” (${pf.name})`
        });
        break;
      }
    }
  }

  const dedup = new Map<string, { portfolioIdHex: string; label: string; portfolioName: string }>();
  for (const m of matches) {
    dedup.set(m.portfolioIdHex, m);
  }
  const uniq = [...dedup.values()];

  if (uniq.length === 1 && uniq[0]) {
    return {
      ok: true,
      portfolioIdHex: uniq[0].portfolioIdHex,
      portfolioName: uniq[0].portfolioName
    };
  }
  if (uniq.length === 0) {
    return { ok: false, error: "not_found" };
  }
  return {
    ok: false,
    error: "ambiguous",
    candidates: uniq.map((u) => ({ portfolioIdHex: u.portfolioIdHex, label: u.label }))
  };
}
