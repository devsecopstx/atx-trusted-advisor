import { QueryClient } from "@tanstack/react-query";

/** Shared defaults for product surfaces (watchlist, xChat rail, portfolio desks). */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: 1
      }
    }
  });
}
