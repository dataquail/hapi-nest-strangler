import "@testing-library/jest-dom";

import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, vi } from "vitest";

import { configureApiTransport } from "@/services/api/transport.shared";
import { navigationRequestStore, pathnameStore } from "@/services/navigation.shared";
import { notificationStore } from "@/services/notifications.shared";

import { installMswLifecycle } from "./msw-server";
import { TEST_API_BASE } from "./typed-handler";

expect.extend(matchers);

// MSW is installed for the whole suite: a View that reads a query fetches on
// mount however the cache was seeded, so an unexpected request fails as an
// unhandled-request error rather than escaping to localhost.
installMswLifecycle();

// Node's fetch needs an absolute URL, which is why the app's relative `/api` will not do.
configureApiTransport({ baseUrl: TEST_API_BASE, headers: {} });

beforeEach(() => {
  notificationStore.set(null);
  navigationRequestStore.set(null);
  pathnameStore.set("/");
});

afterEach(() => {
  cleanup();
});

// jsdom does not implement `matchMedia`; ThemeProvider reads it on mount.
Object.defineProperty(globalThis, "matchMedia", {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
