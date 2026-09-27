import * as path from "node:path";

import { configDefaults, mergeConfig, type ViteUserConfig } from "vitest/config";

import shared from "../../vitest.shared.js";

const runIntegration = process.env.TEST_INTEGRATION === "true";

// The reference layout: `*.spec.ts` unit tests beside the services they mock,
// and `test/**` for tests that compose the server and hit the database.
const config: ViteUserConfig = {
  test: {
    setupFiles: [path.join(import.meta.dirname, "test/setup.ts")],
    globalSetup: [path.join(import.meta.dirname, "test/global-setup.ts")],
    fileParallelism: false,
    sequence: { concurrent: false },
  },
};

const merged = mergeConfig(shared, config);
merged.test.include = runIntegration
  ? ["test/**/*.integration.test.ts"]
  : ["test/**/*.test.ts", "src/**/*.spec.ts"];
merged.test.exclude = runIntegration
  ? [...configDefaults.exclude]
  : ["**/*.integration.test.ts", ...configDefaults.exclude];

export default merged;
