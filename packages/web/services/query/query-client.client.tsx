"use client";

// The browser's QueryClient, held in state so React Strict Mode's double render
// does not build two caches. Bridges and the toaster mount here so a route
// composes this, never the library.

import { Toaster } from "@org/components/primitives/toaster";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

import { NavigationBridge } from "../navigation-bridge.client";
import { NotificationBridge } from "../notification-bridge.client";
import { makeQueryClient } from "./query-client.shared";

export const QueryProvider: React.FC<{ readonly children: React.ReactNode }> = ({ children }) => {
  // Built once per mounted provider; a ref survives Strict Mode's double render without a setter nobody calls.
  const clientRef = React.useRef<QueryClient | null>(null);
  clientRef.current ??= makeQueryClient();
  return (
    <QueryClientProvider client={clientRef.current}>
      {children}
      <NavigationBridge />
      <NotificationBridge />
      <Toaster />
    </QueryClientProvider>
  );
};
