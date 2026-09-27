import "server-only";

import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";

import { getQueryClient } from "./get-query-client.server";

type Prefetchable<A, K extends QueryKey> = Pick<
  UseQueryOptions<A, Error, A, K>,
  "queryKey" | "queryFn"
>;

// `prefetchQuery` swallows a failed fetch by design: the page still renders and
// the client query fetches for itself, surfacing the failure at the nearest
// error boundary where a request failure belongs.
export const prefetchQuery = <A, K extends QueryKey>(options: Prefetchable<A, K>): Promise<void> =>
  getQueryClient().prefetchQuery(options);
