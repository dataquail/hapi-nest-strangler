import { deepStrictEqual, notStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { SessionRootOps } from "@/modules/auth/domain/session/session.root-ops.js";
import { SessionSpecifications } from "@/modules/auth/domain/session/session.specification.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { SessionRepositoryLive } from "./session.repository-live.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const sessionId = SessionId.parse("22222222-2222-2222-2222-222222222222");
const subject = "zitadel-sub-integration";

const insertUserRow = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES (${userId}, 'admin@example.com', 'N/A', 'N/A', 'N/A', now(), now())
  `);

const makeSession = (now: Date) =>
  SessionRootOps.create({
    id: sessionId,
    userId,
    subject,
    now,
    ttlSeconds: 3600,
    absoluteTtlSeconds: 43200,
  });

describe.sequential("SessionRepositoryLive (integration)", () => {
  let db: Database;
  let repo: SessionRepositoryLive;

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new SessionRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "auth.sessions", "user.users");
  });

  it("insert + findOne(withId) round-trips a Session through the DB", async () => {
    await insertUserRow(db);
    const session = makeSession(new Date());
    (await repo.insertOne(session)).unwrap();
    const found = (await repo.findOne(SessionSpecifications.withId(sessionId))).unwrap();
    if (found === null) throw new Error("expected a session");
    deepStrictEqual(found.id, sessionId);
    deepStrictEqual(found.userId, userId);
    deepStrictEqual(found.subject, subject);
    deepStrictEqual(found.revokedAt, null);
  });

  it("findOne returns null for an unknown id (absence is not an error)", async () => {
    deepStrictEqual((await repo.findOne(SessionSpecifications.withId(sessionId))).unwrap(), null);
  });

  it("revoke marks revoked_at and a second revoke is reported as NotFound", async () => {
    await insertUserRow(db);
    (await repo.insertOne(makeSession(new Date()))).unwrap();
    (await repo.deleteOne(sessionId)).unwrap();
    const found = (await repo.findOne(SessionSpecifications.withId(sessionId))).unwrap();
    if (found === null) throw new Error("expected a session");
    notStrictEqual(found.revokedAt, null);
    deepStrictEqual((await repo.deleteOne(sessionId)).unwrapErr()._tag, "SessionNotFound");
  });

  it("update persists expiresAt and lastUsedAt for an unrevoked session", async () => {
    await insertUserRow(db);
    const now = new Date();
    const seed = makeSession(now);
    (await repo.insertOne(seed)).unwrap();
    const later = new Date(now.getTime() + 1800 * 1000);
    const touched = SessionRootOps.touch({ session: seed, now: later, ttlSeconds: 3600 });
    (await repo.updateOne(touched)).unwrap();
    const found = (await repo.findOne(SessionSpecifications.withId(sessionId))).unwrap();
    if (found === null) throw new Error("expected a session");
    deepStrictEqual(found.expiresAt, touched.expiresAt);
    deepStrictEqual(found.lastUsedAt, touched.lastUsedAt);
    deepStrictEqual(found.absoluteExpiresAt, seed.absoluteExpiresAt);
  });

  it("update fails SessionNotFound when the row is revoked", async () => {
    await insertUserRow(db);
    const now = new Date();
    const seed = makeSession(now);
    (await repo.insertOne(seed)).unwrap();
    (await repo.deleteOne(sessionId)).unwrap();
    const touched = SessionRootOps.touch({
      session: seed,
      now: new Date(now.getTime() + 1800 * 1000),
      ttlSeconds: 3600,
    });
    deepStrictEqual((await repo.updateOne(touched)).unwrapErr()._tag, "SessionNotFound");
  });
});
