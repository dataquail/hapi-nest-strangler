import { execFileSync } from "node:child_process";

import { assertTestDatabaseConfigured, runTestMigrations } from "./test-database.js";

// The legacy API's tables share the test database, and a backfill reads
// them; its migrator is the only thing that may create them, so it runs as
// a process rather than being imported.
const migrateLegacyTables = (databaseUrl: string): void => {
  execFileSync("pnpm", ["-F", "@org/legacy-api", "db:migrate:test"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL_TEST: databaseUrl },
  });
};

export default async function globalSetup(): Promise<void> {
  if (process.env.TEST_INTEGRATION === "true") {
    const databaseUrl = assertTestDatabaseConfigured();
    await runTestMigrations();
    migrateLegacyTables(databaseUrl);
  }
}
