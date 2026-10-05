import { assertTestDatabaseConfigured, runTestMigrations } from "./test-database.js";

export default async function globalSetup(): Promise<void> {
  if (process.env.TEST_INTEGRATION === "true") {
    assertTestDatabaseConfigured();
    await runTestMigrations();
  }
}
