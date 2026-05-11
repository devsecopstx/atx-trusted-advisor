export type XoptionsBuilderStep = 1 | 2 | 3 | 4 | 5;

export type XoptionsBuilderUrlState = {
  step: XoptionsBuilderStep;
  symbol: string | null;
  contractId: string | null;
  outlook: string | null;
  strategy: string | null;
};

export const XOPTIONS_BUILDER_SESSION_KEY = "xf_xoptions_builder_state_v1";

export function readXoptionsBuilderUrlState(searchParams: URLSearchParams): XoptionsBuilderUrlState {
  const stepRaw = Number.parseInt(searchParams.get("step") ?? "1", 10);
  const step = stepRaw >= 1 && stepRaw <= 5 ? (stepRaw as XoptionsBuilderStep) : 1;
  return {
    step,
    symbol: searchParams.get("symbol")?.trim().toUpperCase() || null,
    contractId: searchParams.get("contractId")?.trim() || null,
    outlook: searchParams.get("outlook")?.trim() || null,
    strategy: searchParams.get("strategy")?.trim() || null
  };
}

export function buildXoptionsBuilderHref(
  pathname: string,
  state: Partial<XoptionsBuilderUrlState>
): string {
  const params = new URLSearchParams();
  if (state.step != null) {
    params.set("step", String(state.step));
  }
  if (state.symbol) {
    params.set("symbol", state.symbol);
  }
  if (state.contractId) {
    params.set("contractId", state.contractId);
  }
  if (state.outlook) {
    params.set("outlook", state.outlook);
  }
  if (state.strategy) {
    params.set("strategy", state.strategy);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function buildXoptionsReviewHref(input: {
  symbol: string;
  contractId?: string | null;
  expiration?: string | null;
  strike?: number | null;
  side?: "call" | "put" | null;
  step?: XoptionsBuilderStep;
  outlook?: string | null;
  strategy?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("symbol", input.symbol.trim().toUpperCase());
  if (input.contractId) {
    params.set("contractId", input.contractId);
  }
  if (input.expiration) {
    params.set("expiration", input.expiration);
  }
  if (input.strike != null && Number.isFinite(input.strike)) {
    params.set("strike", String(input.strike));
  }
  if (input.side) {
    params.set("side", input.side);
  }
  if (input.step != null) {
    params.set("step", String(input.step));
  }
  if (input.outlook) {
    params.set("outlook", input.outlook);
  }
  if (input.strategy) {
    params.set("strategy", input.strategy);
  }
  return `/xoptions/review?${params.toString()}`;
}

export function persistXoptionsBuilderSession(state: XoptionsBuilderUrlState): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(XOPTIONS_BUILDER_SESSION_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function readXoptionsBuilderSession(): XoptionsBuilderUrlState | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(XOPTIONS_BUILDER_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<XoptionsBuilderUrlState>;
    const stepRaw = Number(parsed.step ?? 1);
    const step = stepRaw >= 1 && stepRaw <= 5 ? (stepRaw as XoptionsBuilderStep) : 1;
    return {
      step,
      symbol: typeof parsed.symbol === "string" ? parsed.symbol : null,
      contractId: typeof parsed.contractId === "string" ? parsed.contractId : null,
      outlook: typeof parsed.outlook === "string" ? parsed.outlook : null,
      strategy: typeof parsed.strategy === "string" ? parsed.strategy : null
    };
  } catch {
    return null;
  }
}
