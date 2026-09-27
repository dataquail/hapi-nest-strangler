import { deepStrictEqual, rejects } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { z } from "zod";

import { type Database, sql } from "./database.js";
import { DatabaseError, DatabaseUnavailable } from "./errors.js";
import { createTestDatabase } from "./test-utils/test-database.js";

const WalletRow = z.object({ id: z.guid(), organization_id: z.guid(), created_at: z.date() });
const CountRow = z.object({ count: z.number() });

const walletA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const walletB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const orgA = "11111111-1111-1111-1111-111111111111";
const orgB = "22222222-2222-2222-2222-222222222222";

const insertWallet = (db: Database, id: string, organizationId: string) =>
  db.exec(sql.unsafe`
    INSERT INTO wallet.wallets (id, organization_id, balance, created_at, updated_at)
    VALUES (${id}, ${organizationId}, 0, now(), now())
  `);

const countWallets = async (db: Database): Promise<number> =>
  (await db.one(sql.type(CountRow)`SELECT count(*)::int AS count FROM wallet.wallets`)).count;

describe("Database (integration)", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await db.exec(sql.unsafe`TRUNCATE TABLE wallet.wallets CASCADE`);
  });

  it("decodes rows through the zod schema named by sql.type, with Dates for timestamps", async () => {
    await insertWallet(db, walletA, orgA);
    const row = await db.one(
      sql.type(
        WalletRow,
      )`SELECT id, organization_id, created_at FROM wallet.wallets WHERE id = ${walletA}`,
    );
    deepStrictEqual(row.organization_id, orgA);
    deepStrictEqual(row.created_at instanceof Date, true);
  });

  it("maybeOne returns null for no row and exec returns the affected count", async () => {
    deepStrictEqual(
      await db.maybeOne(
        sql.type(WalletRow)`SELECT id, organization_id, created_at FROM wallet.wallets`,
      ),
      null,
    );
    deepStrictEqual(await insertWallet(db, walletA, orgA), 1);
  });

  it("commits the outermost transaction and rolls back on failure", async () => {
    await db.withTransaction(async () => {
      await insertWallet(db, walletA, orgA);
    });
    deepStrictEqual(await countWallets(db), 1);
    await rejects(
      db.withTransaction(async () => {
        await insertWallet(db, walletB, orgB);
        throw new Error("abort");
      }),
      /abort/,
    );
    deepStrictEqual(await countWallets(db), 1);
  });

  it("a nested transaction is a savepoint: a caught nested failure keeps the outer work", async () => {
    await db.withTransaction(async () => {
      deepStrictEqual(db.hasOpenTransaction(), true);
      await insertWallet(db, walletA, orgA);
      await db
        .withTransaction(async () => {
          await insertWallet(db, walletB, orgB);
          throw new Error("nested abort");
        })
        .catch(() => undefined);
      deepStrictEqual(await countWallets(db), 1);
    });
    deepStrictEqual(db.hasOpenTransaction(), false);
    deepStrictEqual(await countWallets(db), 1);
  });

  it("statements inside a transaction join it: uncommitted rows are visible inside", async () => {
    let seenInside = 0;
    await db.withTransaction(async () => {
      await insertWallet(db, walletA, orgA);
      seenInside = await countWallets(db);
    });
    deepStrictEqual(seenInside, 1);
  });

  it("translates a unique violation into DatabaseError", async () => {
    await insertWallet(db, walletA, orgA);
    await rejects(insertWallet(db, walletB, orgA), (error: unknown) => {
      deepStrictEqual(error instanceof DatabaseError, true);
      deepStrictEqual((error as DatabaseError).type, "unique_violation");
      return true;
    });
  });

  it("a row that does not match its schema is a defect, not a typed failure", async () => {
    await insertWallet(db, walletA, orgA);
    const Wrong = z.object({ id: z.number() });
    await rejects(db.any(sql.type(Wrong)`SELECT id FROM wallet.wallets`), (error: unknown) => {
      deepStrictEqual(error instanceof DatabaseError, false);
      deepStrictEqual(error instanceof DatabaseUnavailable, false);
      return true;
    });
  });
});
