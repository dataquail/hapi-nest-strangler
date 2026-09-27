import type { Knex } from "knex";

import * as m0001 from "./0001_create_schema_wallet.js";
import * as m0002 from "./0002_create_table_wallet_wallets.js";

export type MigrationModule = {
  readonly up: (knex: Knex) => Promise<void>;
};

// Statically imported rather than discovered on disk, so one mechanism serves the
// CLI, the test suites and acceptance alike, and so a migration cannot be added
// without appearing here. `migrator.test.ts` asserts this list matches the
// directory. Forward-only: there are no downs (ADR-0011).
export const migrations: Readonly<Record<string, MigrationModule>> = {
  "0001_create_schema_wallet": m0001,
  "0002_create_table_wallet_wallets": m0002,
};
