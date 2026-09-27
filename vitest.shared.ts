import * as path from "node:path";

import { configDefaults, type ViteUserConfig } from "vitest/config";

const rootDir = import.meta.dirname;

// Two mutually exclusive test modes, selected by the `TEST_INTEGRATION` env
// var (set by the `test:integration` scripts). The unit suite runs every
// `*.test.ts` EXCEPT `*.integration.test.ts` and needs no auxiliary services.
// The integration suite runs ONLY `*.integration.test.ts` and requires a real
// database — its global-setup hard-fails (never skips) when the DB is
// unconfigured or unreachable.
const runIntegration = process.env.TEST_INTEGRATION === "true";

const alias = (name: string) => {
  const scopedName = `@org/${name}`;
  return {
    [`${scopedName}/test`]: path.join(rootDir, "packages", name, "test"),
    [`${scopedName}`]: path.join(rootDir, "packages", name, "src"),
  };
};

const config: ViteUserConfig = {
  test: {
    onConsoleLog: (log) => {
      console.log(log);
    },
    setupFiles: [path.join(rootDir, "setupTests.ts")],
    fakeTimers: {
      toFake: undefined,
    },
    sequence: {
      concurrent: true,
    },
    include: runIntegration
      ? ["test/**/*.integration.test.ts", "src/**/*.integration.test.ts"]
      : ["test/**/*.test.ts", "src/**/*.test.ts"],
    exclude: runIntegration
      ? [...configDefaults.exclude]
      : ["**/*.integration.test.ts", ...configDefaults.exclude],
    // A package may legitimately have tests for only one suite, so an isolated
    // per-package run of the other suite finds zero files. The integration
    // global-setup, not an empty file set, is what enforces "fail, don't skip".
    passWithNoTests: true,
    alias: {
      ...alias("authz"),
      ...alias("cli"),
      ...alias("contracts"),
      ...alias("database"),
      ...alias("event-bus"),
      ...alias("server"),
      ...alias("unit-of-work"),
    },
  },
};

export default config;
