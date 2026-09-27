import { existsSync } from "node:fs";
import * as path from "node:path";

import { coverageConfigDefaults, defineConfig } from "vitest/config";

// Coverage is a ROOT-level concern in Vitest workspace mode: a project config's
// `test.coverage` is ignored, and a per-package run would drop every file
// outside that package's own root. So every coverage run goes through this
// config (`pnpm test:coverage:*`) as a root workspace run, writing a blob
// report that `pnpm coverage:merge` folds into one number.
//
// Only the merged run gates. No single suite sees all the code — HTTP endpoints
// are reachable only from the integration suite, command handlers only from the
// unit suite — so thresholds checked on one blob run would fail on code the
// other run covers.
const isMergedRun = process.argv.some((arg) => arg.startsWith("--merge-reports"));

export default defineConfig({
  test: {
    // Projects are listed explicitly so packages/acceptance/ (Playwright) isn't
    // auto-discovered and its `*.spec.ts` files aren't loaded as Vitest tests.
    projects: [
      "packages/authz",
      "packages/contracts",
      "packages/database",
      "packages/event-bus",
      "packages/jobs",
      "packages/server",
      "packages/unit-of-work",
      "packages/web",
    ].filter((project) => existsSync(path.join(import.meta.dirname, project, "vitest.config.ts"))),
    coverage: {
      provider: "v8",
      reporter: isMergedRun ? ["text-summary", "html", "lcov", "json-summary"] : ["text-summary"],
      include: [
        "packages/authz/src/**/*.ts",
        "packages/contracts/src/**/*.ts",
        "packages/database/src/**/*.ts",
        "packages/event-bus/src/**/*.ts",
        "packages/jobs/src/**/*.ts",
        "packages/server/src/**/*.{ts,tsx}",
        "packages/unit-of-work/src/**/*.ts",
        "packages/web/features/**/*.{ts,tsx}",
        "packages/web/services/**/*.{ts,tsx}",
      ],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "**/*.test.{ts,tsx}",
        "**/test-utils/**",
        "**/test/**",
        "**/testing.ts",
        "**/*-fake.ts",
        "packages/server/src/main.ts",
        "packages/server/src/instrumentation.ts",
        "packages/jobs/src/main.ts",
        "packages/database/src/scripts/**",
        "packages/database/knexfile.ts",
        "packages/contracts/src/generated/**",
        "packages/contracts/src/scripts/**",
        "packages/web/**/*.server.ts",
      ],
      // A ratchet, not an aspiration: raise a floor when coverage rises; never
      // lower one to make a red build green. Set once the merged number exists.
      thresholds: isMergedRun
        ? {
            statements: 87,
            branches: 72,
            functions: 87,
            lines: 90,
          }
        : undefined,
    },
  },
});
