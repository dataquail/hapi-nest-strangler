// Integration-tier render harness. Mounts what a real route composes:
// ThemeProvider → QueryClientProvider → notification bridge → Toaster.
//
// The navigation bridge is deliberately absent: it holds the Next router. A
// test that cares where the app tried to go reads `navigationRequestStore`.

import { Toaster } from "@org/components/primitives/toaster";
import { ThemeProvider } from "@org/components/providers/theme-provider";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import * as React from "react";

import { NotificationBridge } from "@/services/notification-bridge.client";

import { makeTestQueryClient } from "./query-harness";

const HarnessProviders: React.FC<{
  readonly children: React.ReactNode;
  readonly client: QueryClient;
}> = ({ children, client }) => (
  <ThemeProvider>
    <QueryClientProvider client={client}>
      <React.Suspense fallback="loading">{children}</React.Suspense>
      <NotificationBridge />
      <Toaster />
    </QueryClientProvider>
  </ThemeProvider>
);

export const renderWithHarness = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult & { readonly client: QueryClient } => {
  const client = makeTestQueryClient();
  const result = render(ui, {
    ...options,
    wrapper: ({ children }) => <HarnessProviders client={client}>{children}</HarnessProviders>,
  });
  return { ...result, client };
};
