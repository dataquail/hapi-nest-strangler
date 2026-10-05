import { deepStrictEqual } from "node:assert";

import { afterAll, describe, it } from "vitest";

import { assertTestDatabase, runMigrations } from "../src/lib/migrator";
import { closeKnex, getKnex } from "./helpers/db";

const EXPECTED_TABLES = [
  "api_tokens",
  "auth_identities",
  "device_grants",
  "invitations",
  "memberships",
  "organization_roles",
  "organizations",
  "roles",
  "sessions",
  "users",
];

describe("legacy migrations (integration)", () => {
  afterAll(closeKnex);

  it("creates every application table in public and is idempotent on a second run", async () => {
    const rows = await getKnex()
      .select<{ tablename: string }[]>("tablename")
      .from("pg_tables")
      .where({ schemaname: "public" })
      .whereNot("tablename", "like", "knex_migrations%")
      .orderBy("tablename");
    deepStrictEqual(
      rows.map((row) => row.tablename),
      EXPECTED_TABLES,
    );
    deepStrictEqual(await runMigrations(assertTestDatabase(process.env.DATABASE_URL_TEST)), []);
  });
});
