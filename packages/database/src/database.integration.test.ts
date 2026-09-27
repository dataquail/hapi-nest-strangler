import { deepStrictEqual, rejects } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { z } from "zod";

import { type Database, sql } from "./database.js";
import { DatabaseError, DatabaseUnavailable } from "./errors.js";
import { createTestDatabase } from "./test-utils/test-database.js";

const OrgRow = z.object({ id: z.guid(), name: z.string(), created_at: z.date() });
const CountRow = z.object({ count: z.number() });

const orgA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const orgB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const insertOrg = (db: Database, id: string, name: string) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${id}, ${name}, now(), now(), null)
  `);

const countOrgs = async (db: Database): Promise<number> =>
  (
    await db.one(
      sql.type(CountRow)`SELECT count(*)::int AS count FROM "organization".organizations`,
    )
  ).count;

describe("Database (integration)", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await db.exec(sql.unsafe`TRUNCATE TABLE "organization".organizations CASCADE`);
  });

  it("decodes rows through the zod schema named by sql.type, with Dates for timestamps", async () => {
    await insertOrg(db, orgA, "Acme");
    const row = await db.one(
      sql.type(
        OrgRow,
      )`SELECT id, name, created_at FROM "organization".organizations WHERE id = ${orgA}`,
    );
    deepStrictEqual(row.name, "Acme");
    deepStrictEqual(row.created_at instanceof Date, true);
  });

  it("maybeOne returns null for no row and exec returns the affected count", async () => {
    deepStrictEqual(
      await db.maybeOne(
        sql.type(OrgRow)`SELECT id, name, created_at FROM "organization".organizations`,
      ),
      null,
    );
    deepStrictEqual(await insertOrg(db, orgA, "Acme"), 1);
  });

  it("commits the outermost transaction and rolls back on failure", async () => {
    await db.withTransaction(async () => {
      await insertOrg(db, orgA, "Acme");
    });
    deepStrictEqual(await countOrgs(db), 1);
    await rejects(
      db.withTransaction(async () => {
        await insertOrg(db, orgB, "Beta");
        throw new Error("abort");
      }),
      /abort/,
    );
    deepStrictEqual(await countOrgs(db), 1);
  });

  it("a nested transaction is a savepoint: a caught nested failure keeps the outer work", async () => {
    await db.withTransaction(async () => {
      deepStrictEqual(db.hasOpenTransaction(), true);
      await insertOrg(db, orgA, "Acme");
      await db
        .withTransaction(async () => {
          await insertOrg(db, orgB, "Beta");
          throw new Error("nested abort");
        })
        .catch(() => undefined);
      deepStrictEqual(await countOrgs(db), 1);
    });
    deepStrictEqual(db.hasOpenTransaction(), false);
    deepStrictEqual(await countOrgs(db), 1);
  });

  it("statements inside a transaction join it: uncommitted rows are visible inside", async () => {
    let seenInside = 0;
    await db.withTransaction(async () => {
      await insertOrg(db, orgA, "Acme");
      seenInside = await countOrgs(db);
    });
    deepStrictEqual(seenInside, 1);
  });

  it("translates a unique violation into DatabaseError", async () => {
    await insertOrg(db, orgA, "Acme");
    await rejects(insertOrg(db, orgA, "Acme again"), (error: unknown) => {
      deepStrictEqual(error instanceof DatabaseError, true);
      deepStrictEqual((error as DatabaseError).type, "unique_violation");
      return true;
    });
  });

  it("translates a foreign-key violation into DatabaseError", async () => {
    await rejects(
      db.exec(sql.unsafe`
        INSERT INTO todos.todos (id, organization_id, title, completed, created_at, updated_at)
        VALUES (gen_random_uuid(), ${orgA}, 'orphan', false, now(), now())
      `),
      (error: unknown) => {
        deepStrictEqual((error as DatabaseError).type, "foreign_key_violation");
        return true;
      },
    );
  });

  it("a row that does not match its schema is a defect, not a typed failure", async () => {
    await insertOrg(db, orgA, "Acme");
    const Wrong = z.object({ id: z.number() });
    await rejects(
      db.any(sql.type(Wrong)`SELECT id FROM "organization".organizations`),
      (error: unknown) => {
        deepStrictEqual(error instanceof DatabaseError, false);
        deepStrictEqual(error instanceof DatabaseUnavailable, false);
        return true;
      },
    );
  });
});
