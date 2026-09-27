import { register } from "tsx/cjs/api";

import { assertTestDatabase, resetAndMigrate } from "../src/lib/migrator";

// knex requires each migration file, so the TypeScript hook must be in place
// here too; then public is dropped and replayed from the migrations directory.
export default async function globalSetup(): Promise<void> {
  if (process.env.TEST_INTEGRATION === "true") {
    register();
    await resetAndMigrate(assertTestDatabase(process.env.DATABASE_URL_TEST));
  }
}
