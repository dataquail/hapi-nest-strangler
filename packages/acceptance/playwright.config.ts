import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

// Load the repo's root .env so ZITADEL_* vars are available to global-setup
// and propagate via webServer.env to the API server.
dotenv.config({ path: "../../.env" });

// Acceptance configuration follows the layered architecture from the
// reference API's acceptance-testing doc: specs are business-language only,
// drivers/pages hide selectors, infrastructure (this file + global-setup.ts)
// wires real processes. The webServer entries spawn the legacy hapi API and
// the Nest server (both against the test DB) and the Next renderer before
// tests run; global-setup replays both migrators once and pre-seeds the
// admin row.
//
// Auth: an `auth-setup` project runs the real Zitadel hosted-UI login as
// admin and stamps the cookie into storageState. The `chromium` project
// depends on it and inherits the storage state so each spec starts
// authenticated. login.spec.ts opts out of the storage state to exercise
// the full UI flow on every run.

const isCi = process.env.CI !== undefined && process.env.CI !== "";
// Browser-facing origin (Next renderer; ADR-0018). Browser navigation
// uses `localhost` so the session cookie set by Zitadel's OIDC callback
// (registered as `http://localhost:3000/api/auth/callback`) is visible
// to the test origin — the cookie domain MUST match the registered
// redirect URI.
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
// The legacy hapi API is the BFF the browser reaches through Next; the Nest
// server is reached only from hapi, over the inter-service seam (ADR-0034).
const API_URL = process.env.API_URL ?? "http://localhost:9000";
const NEST_URL = process.env.NEST_URL ?? "http://localhost:3001";
// `WEB_PROBE_URL` and `BFF_PROBE_URL` are *server-side only* readiness
// probes used by Playwright's `webServer.url`. They go to `127.0.0.1`
// instead of `localhost` to dodge an IPv6/IPv4 resolution race: Node
// 18+ uses verbatim `getaddrinfo` order, and on dual-stack runners
// `localhost` may resolve to `::1` first. The servers bind on the IPv4
// wildcard — if `fetch` picks `::1` it gets ECONNREFUSED and Playwright's
// probe times out. Pinning the probes to `127.0.0.1` forces IPv4 and
// matches the listeners. The browser-side `baseURL` (above) stays
// `localhost` because that's what Zitadel's redirect URI is registered as.
const toIpv4 = (url: string): string => url.replace(/\/\/localhost(:|\/|$)/, "//127.0.0.1$1");
const WEB_PROBE_URL = toIpv4(APP_URL);
const BFF_PROBE_URL = toIpv4(API_URL);
const NEST_INTERNAL_URL = toIpv4(NEST_URL);
// Server-side rewrite target (Next → hapi). Also pinned to IPv4 for the
// same reason; Next's `/api/*` rewrite runs server-side and is not
// browser-visible.
const SERVER_INTERNAL_URL = process.env.SERVER_INTERNAL_URL ?? BFF_PROBE_URL;
// Both servers derive the seam's HS256 token from this secret; the fallback
// keeps a local run from needing one more entry in .env.
const INTER_SERVICE_JWT_SECRET =
  process.env.INTER_SERVICE_JWT_SECRET ?? "acceptance-inter-service-secret-0123456789abcdef";
const DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ??
  "postgresql://postgres:postgres@localhost:5432/nest-hexagon-test";

if (!DATABASE_URL_TEST.toLowerCase().includes("test")) {
  throw new Error(
    `[acceptance] refusing to start — DATABASE_URL_TEST name must contain 'test', got '${DATABASE_URL_TEST}'`,
  );
}

const ADMIN_STORAGE_STATE = "playwright/.auth/admin.json";

export default defineConfig({
  testDir: "./",
  // One worker keeps DB-resetting per test deterministic. The test suite is
  // small; parallelism would buy little here and complicate truncation.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCi,
  retries: 0,
  // A terminal-only reporter writes no `playwright-report/`, which the CI
  // artifact upload expects — pair `line` with `html` so the run leaves one.
  reporter: isCi ? [["line"], ["html", { open: "never" }]] : "list",

  globalSetup: "./global-setup.ts",

  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "auth-setup",
      testMatch: /setup\/auth\.setup\.ts/,
      // No storageState — this IS the project that creates it.
    },
    {
      name: "member-setup",
      testMatch: /setup\/member\.setup\.ts/,
      // No storageState — logs in the regular member to create it.
    },
    {
      name: "chromium",
      testDir: "./specs",
      // Skip the login spec here; it runs in its own project below so it
      // can start unauthenticated.
      testIgnore: /login\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // Default to the admin session. Org-scoped specs (add-todo) opt
        // into the member session via `test.use({ storageState })`; both
        // setups are dependencies so either cookie is ready.
        storageState: ADMIN_STORAGE_STATE,
      },
      dependencies: ["auth-setup", "member-setup"],
    },
    {
      name: "login",
      testDir: "./specs",
      testMatch: /login\.spec\.ts/,
      // Fresh, unauthenticated browser context so the spec drives the full
      // OIDC dance (no storageState).
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      // The Nest server, against the TEST database: the wallet's internal
      // API, which hapi calls while creating an organization. It has no
      // public route, so readiness is the listening port. We run `tsx` (no
      // watch) inside playwright — `tsx watch` would compete with Next's
      // file watcher for inotify slots in CI and adds no value for a
      // non-mutating test process.
      name: "nest",
      command:
        "pnpm -F @org/server exec tsx --tsconfig tsconfig.src.json --import ./src/instrumentation.ts src/main.ts",
      port: Number(new URL(NEST_URL).port),
      wait: { stdout: /Server listening on/ },
      cwd: "../../",
      env: {
        ...process.env,
        DATABASE_URL: DATABASE_URL_TEST,
        ENV: "dev",
        PORT: String(new URL(NEST_URL).port),
        INTER_SERVICE_JWT_SECRET,
        OTLP_URL: process.env.OTLP_URL ?? "http://localhost:4318/v1/traces",
        STRIPE_USE_FAKE: "true",
      },
      // Acceptance always spawns its own server processes — reusing a running
      // dev server would mean the test runs against the *dev* DB instead of
      // the test DB (the env override only takes effect when Playwright
      // actually starts the command). Kill dev servers before running
      // acceptance.
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // The legacy hapi API, against the TEST database: the BFF that serves
      // every browser and CLI route and terminates auth. Its wallet calls and
      // the routes it forwards go to the Nest server above.
      name: "bff",
      command: "pnpm -F @org/legacy-api exec tsx server.ts",
      url: `${BFF_PROBE_URL}/health-check`,
      wait: { stdout: /Server running at/ },
      cwd: "../../",
      env: {
        ...process.env,
        ENV_FILE: "disabled",
        DATABASE_URL: DATABASE_URL_TEST,
        LEGACY_API_PORT: String(new URL(API_URL).port),
        APP_URL,
        NEST_SERVER_URL: NEST_INTERNAL_URL,
        INTER_SERVICE_JWT_SECRET,
        SESSION_COOKIE_SECRET:
          process.env.SESSION_COOKIE_SECRET ?? "acceptance-session-cookie-secret",
      },
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // Next renderer. We run a real production build + `next start`
      // rather than `next dev` because:
      //   1. dev compiles routes lazily, so the URL probe can time out
      //      while Turbopack is still warming up — flaky in CI.
      //   2. dev installs file watchers that compete with `tsx watch`'s
      //      and the runner's own inotify slots.
      // `next start` boots in ~1s once the build has run. The build is
      // wired into a `pretest` script in @org/acceptance so a fresh
      // `pnpm test:acceptance` always sees current source. `.next/cache`
      // makes subsequent runs fast.
      //
      // SERVER_INTERNAL_URL points the /api/* rewrite at the test-DB-bound
      // hapi API above. APP_URL stays :3000 so hapi redirects post-sign-in
      // to the same origin Playwright drives.
      name: "web",
      command: "pnpm -F @org/web start",
      url: WEB_PROBE_URL,
      cwd: "../../",
      env: {
        ...process.env,
        SERVER_INTERNAL_URL,
        NEST_INTERNAL_URL,
        OTLP_URL: process.env.OTLP_URL ?? "http://localhost:4318/v1/traces",
      },
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
