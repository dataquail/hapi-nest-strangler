import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { z } from "zod";

import { createTestDatabase, runTestMigrations, truncate } from "../test-utils/test-database.js";
import { purgeExpiredSessions } from "./purge-expired-sessions.js";

const userId = "11111111-1111-1111-1111-111111111111";
const CountRow = z.object({ value: z.number() });
const IdRow = z.object({ id: z.string() });

type SessionShape = {
  readonly id: string;
  readonly expiresAt: string;
  readonly absoluteExpiresAt: string;
  readonly revokedAt: string | null;
};

const seedUser = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES (${userId}, 'admin@example.com', 'N/A', 'N/A', 'N/A', now(), now())
  `);

const seedSession = (db: Database, s: SessionShape) =>
  db.exec(sql.unsafe`
    INSERT INTO auth.sessions (id, user_id, subject, expires_at, absolute_expires_at, revoked_at, created_at, last_used_at)
    VALUES (${s.id}, ${userId}, 'zitadel-sub', ${s.expiresAt}::timestamptz, ${s.absoluteExpiresAt}::timestamptz,
            ${s.revokedAt}::timestamptz, now(), now())
  `);

const countSessions = async (db: Database) =>
  (await db.one(sql.type(CountRow)`SELECT count(*)::int AS value FROM auth.sessions`)).value;

const findSessionIds = async (db: Database) =>
  (await db.any(sql.type(IdRow)`SELECT id::text AS id FROM auth.sessions ORDER BY id`)).map(
    (row) => row.id,
  );

describe.sequential("purgeExpiredSessions (integration)", () => {
  let db: Database;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
  });
  afterAll(async () => {
    await db.end();
  });
  beforeEach(async () => {
    await truncate(db, "auth.sessions", "user.users");
    await seedUser(db);
  });

  it("deletes rows whose expires_at has passed and keeps still-valid rows", async () => {
    await seedSession(db, {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      expiresAt: "1999-01-01T00:00:00Z",
      absoluteExpiresAt: "1999-01-02T00:00:00Z",
      revokedAt: null,
    });
    await seedSession(db, {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      expiresAt: "2099-01-01T00:00:00Z",
      absoluteExpiresAt: "2099-01-02T00:00:00Z",
      revokedAt: null,
    });
    const result = await purgeExpiredSessions(db);
    deepStrictEqual(result, { skipped: false, rowsPurged: 1 });
    deepStrictEqual(await findSessionIds(db), ["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"]);
  });

  it("deletes revoked rows past the 7-day grace and keeps recently revoked ones", async () => {
    await seedSession(db, {
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      expiresAt: "2099-01-01T00:00:00Z",
      absoluteExpiresAt: "2099-01-02T00:00:00Z",
      revokedAt: "1999-01-01T00:00:00Z",
    });
    await db.exec(sql.unsafe`
      INSERT INTO auth.sessions (id, user_id, subject, expires_at, absolute_expires_at, revoked_at, created_at, last_used_at)
      VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', ${userId}, 'zitadel-sub', '2099-01-01T00:00:00Z', '2099-01-02T00:00:00Z',
              now() - interval '1 hour', now(), now())
    `);
    const result = await purgeExpiredSessions(db);
    deepStrictEqual(result, { skipped: false, rowsPurged: 1 });
    deepStrictEqual(await findSessionIds(db), ["dddddddd-dddd-dddd-dddd-dddddddddddd"]);
  });

  it("is a no-op on an empty table", async () => {
    deepStrictEqual(await purgeExpiredSessions(db), { skipped: false, rowsPurged: 0 });
    deepStrictEqual(await countSessions(db), 0);
  });
});
