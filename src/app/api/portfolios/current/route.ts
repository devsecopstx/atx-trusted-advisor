import { proxyPortfolioRequestToBackend } from "@/lib/backend-bff";
import { GET as getDefaultPortfolio } from "../default/route";

/** Alias for `GET /api/portfolios/default` — matches operator docs (`/api/portfolios/current`). */
export async function GET(request: Request) {
  const proxied = await proxyPortfolioRequestToBackend(request);
  if (proxied) {
    return proxied;
  }
  return getDefaultPortfolio(request);
}
