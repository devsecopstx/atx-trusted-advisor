import { proxyRequestToBackend } from "@/lib/backend-bff";
import { GET as getDefaultPortfolio } from "../default/route";

/** Alias for `GET /api/portfolios/default` — matches operator docs (`/api/portfolios/current`). */
export async function GET(request: Request) {
  const proxied = await proxyRequestToBackend(request);
  if (proxied) {
    return proxied;
  }
  return getDefaultPortfolio(request);
}
