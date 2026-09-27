import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";
import { z } from "zod";

import { sql } from "./database.js";
import { MODULE_SCHEMAS, runMigrations } from "./migrator.js";
import { assertTestDatabaseConfigured, createTestDatabase } from "./test-utils/test-database.js";

const SchemaRow = z.object({ schema_name: z.string() });

describe("migrator (integration)", () => {
  it("creates every module schema and is idempotent on a second run", async () => {
    const db = await createTestDatabase();
    try {
      const rows = await db.any(
        sql.type(SchemaRow)`SELECT schema_name FROM information_schema.schemata`,
      );
      const present = new Set(rows.map((row) => row.schema_name));
      for (const schema of MODULE_SCHEMAS) {
        deepStrictEqual(present.has(schema), true, `schema ${schema} missing`);
      }
      const applied = await runMigrations({ url: assertTestDatabaseConfigured(), ssl: false });
      deepStrictEqual(applied, []);
    } finally {
      await db.end();
    }
  });
});
