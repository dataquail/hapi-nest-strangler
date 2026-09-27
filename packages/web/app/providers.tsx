"use client";

// Provider stack for the whole app: theme, then the query client (which mounts
// the router and toast bridges plus the Toaster they feed).

import { ThemeProvider } from "@org/components/providers/theme-provider";

import { QueryProvider } from "@/services/query/query-client.client";

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    <QueryProvider>{children}</QueryProvider>
  </ThemeProvider>
);
