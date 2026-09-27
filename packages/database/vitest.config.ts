import * as path from "node:path";

import { mergeConfig, type UserConfigExport } from "vitest/config";

import shared from "../../vitest.shared.js";

const config: UserConfigExport = {
  test: {
    // Integration tests share one Postgres database, so files run one at a time.
    fileParallelism: false,
    sequence: { concurrent: false },
    globalSetup: [path.join(import.meta.dirname, "src/test-utils/global-setup.ts")],
  },
};

export default mergeConfig(shared, config);
