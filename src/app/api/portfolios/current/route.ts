import { GET as getDefaultPortfolio } from "../default/route";

/** Alias for `GET /api/portfolios/default` — matches operator docs (`/api/portfolios/current`). */
export async function GET() {
  return getDefaultPortfolio();
}
