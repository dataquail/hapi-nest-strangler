// Harnesses for the ViewModel and View tiers.
//
// A ViewModel is a hook over TanStack Query, so its test renders the hook under
// a fresh QueryClient and drives it through the returned value. A View's
// contract is "given this ViewModel output, render this; on this interaction,
// call that", so its test stubs the ViewModel module and renders the View bare.

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  renderHook,
  type RenderHookResult,
  type RenderResult,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { afterEach } from "vitest";

import { makeQueryClient } from "@/services/query/query-client.shared";

const liveClients: Array<QueryClient> = [];

afterEach(() => {
  while (liveClients.length > 0) liveClients.pop()?.clear();
});

export const makeTestQueryClient = (): QueryClient => {
  const client = makeQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, staleTime: 0 } });
  liveClients.push(client);
  return client;
};

const Providers: React.FC<{ readonly client: QueryClient; readonly children: React.ReactNode }> = ({
  children,
  client,
}) => (
  <QueryClientProvider client={client}>
    <React.Suspense fallback="loading">{children}</React.Suspense>
  </QueryClientProvider>
);

export type HookHarness<A> = RenderHookResult<A, undefined> & {
  readonly client: QueryClient;
  /** Waits until the predicate holds against the latest hook value. */
  readonly settle: (predicate: (value: A) => boolean) => Promise<A>;
};

export const renderViewModel = <A,>(
  hook: () => A,
  client: QueryClient = makeTestQueryClient(),
): HookHarness<A> => {
  const rendered = renderHook(hook, {
    wrapper: ({ children }) => <Providers client={client}>{children}</Providers>,
  });
  return {
    ...rendered,
    client,
    settle: async (predicate) => {
      await waitFor(() => {
        // Suspended renders leave no value behind; a null is "not yet".
        if (rendered.result.current === null || !predicate(rendered.result.current))
          throw new Error("not settled");
      });
      return rendered.result.current;
    },
  };
};

export const renderView = (
  ui: React.ReactElement,
  client: QueryClient = makeTestQueryClient(),
): RenderResult & { readonly client: QueryClient } => ({
  ...render(<Providers client={client}>{ui}</Providers>),
  client,
});
