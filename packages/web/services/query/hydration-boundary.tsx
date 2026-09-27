import "server-only";

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import * as React from "react";

import { getQueryClient } from "./get-query-client.server";

// One component for the whole server-to-browser handoff: run the route's
// prefetches, dehydrate the per-request cache, and hold the client subtree
// behind Suspense while it mounts. A failed prefetch yields no entry rather
// than throwing; the client query fetches for itself.
export const QueryHydrationBoundary = async ({
  children,
  fallback,
  prefetch = [],
}: {
  readonly prefetch?: ReadonlyArray<Promise<void>>;
  readonly fallback: React.ReactNode;
  readonly children: React.ReactNode;
}): Promise<React.ReactElement> => {
  await Promise.all(prefetch);
  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <React.Suspense fallback={fallback}>{children}</React.Suspense>
    </HydrationBoundary>
  );
};
