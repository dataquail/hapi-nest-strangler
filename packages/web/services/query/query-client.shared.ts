import { QueryClient } from "@tanstack/react-query";

// Long enough that a dehydrated page is not refetched the instant it hydrates,
// short enough that a stale page is not served indefinitely.
const STALE_TIME_MS = 30_000;

export const makeQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_TIME_MS, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
