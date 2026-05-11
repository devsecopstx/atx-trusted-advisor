export type ParsedYahooOptionContractId = {
  underlying: string;
  expirationYyyyMmDd: string;
  side: "call" | "put";
  strike: number;
};

export function toYahooOptionContractId(input: {
  underlying: string;
  expirationYyyyMmDd: string;
  side: "call" | "put";
  strike: number;
}): string {
  const underlying = input.underlying.trim().toUpperCase();
  const expDate = input.expirationYyyyMmDd.replace(/-/g, "").slice(2);
  const typeChar = input.side === "call" ? "C" : "P";
  const strikeStr = String(Math.round(input.strike * 1000)).padStart(8, "0");
  return `${underlying}${expDate}${typeChar}${strikeStr}`;
}

export function parseYahooOptionContractId(contractId: string): ParsedYahooOptionContractId | null {
  const raw = contractId.trim().toUpperCase();
  const match = /^([A-Z0-9.\-]{1,10})(\d{6})([CP])(\d{8})$/.exec(raw);
  if (!match) {
    return null;
  }
  const [, underlying, yymmdd, sideChar, strikeRaw] = match;
  const yy = Number.parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const century = yy >= 70 ? 1900 : 2000;
  const expirationYyyyMmDd = `${century + yy}-${mm}-${dd}`;
  const strike = Number.parseInt(strikeRaw, 10) / 1000;
  if (!Number.isFinite(strike) || strike <= 0) {
    return null;
  }
  return {
    underlying,
    expirationYyyyMmDd,
    side: sideChar === "C" ? "call" : "put",
    strike
  };
}
