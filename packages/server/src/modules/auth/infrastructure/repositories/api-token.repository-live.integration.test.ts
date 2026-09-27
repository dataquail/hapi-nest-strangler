import { deepStrictEqual, notStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token/api-token.root-ops.js";
import { ApiTokenSpecifications } from "@/modules/auth/domain/api-token/api-token.specification.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { ApiTokenRepositoryLive } from "./api-token.repository-live.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const idA = ApiTokenId.parse("22222222-2222-2222-2222-222222222222");
const idB = ApiTokenId.parse("33333333-3333-3333-3333-333333333333");
const DAY_MS = 86_400_000;

const insertUserRow = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES (${userId}, 'tokens@example.com', 'N/A', 'N/A', 'N/A', now(), now())
  `);

const make = (id: ApiTokenId, hash: string, createdAt: Date) =>
  ApiTokenRootOps.mint({
    id,
    userId,
    tokenHash: hash,
    prefix: "pat_abcd1234",
    label: "ci",
    now: createdAt,
    expiresAt: new Date(createdAt.getTime() + 90 * DAY_MS),
  });

describe.sequential("ApiTokenRepositoryLive (integration)", () => {
  let db: Database;
  let repo: ApiTokenRepositoryLive;

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new ApiTokenRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "auth.api_tokens", "user.users");
  });

  it("insert + findOne by id and by hash round-trip a token through the DB", async () => {
    await insertUserRow(db);
    (await repo.insertOne(make(idA, "hash-A", new Date()))).unwrap();
    const byId = (await repo.findOne(ApiTokenSpecifications.withId(idA))).unwrap();
    const byHash = (await repo.findOne(ApiTokenSpecifications.withHash("hash-A"))).unwrap();
    if (byId === null || byHash === null) throw new Error("expected a token");
    deepStrictEqual(byId.id, idA);
    deepStrictEqual(byId.userId, userId);
    deepStrictEqual(byId.tokenHash, "hash-A");
    deepStrictEqual(byId.revokedAt, null);
    deepStrictEqual(byHash.id, idA);
  });

  it("findOne returns null for an unknown hash (absence is not an error)", async () => {
    deepStrictEqual(
      (await repo.findOne(ApiTokenSpecifications.withHash("missing"))).unwrap(),
      null,
    );
  });

  it("findMany(forUser) returns active tokens newest-first and hides revoked", async () => {
    await insertUserRow(db);
    const now = new Date();
    (await repo.insertOne(make(idA, "a", now))).unwrap();
    (await repo.insertOne(make(idB, "b", new Date(now.getTime() + 3_600_000)))).unwrap();
    (await repo.deleteOne(idA)).unwrap();
    const mine = (await repo.findMany(ApiTokenSpecifications.forUser(userId))).unwrap();
    deepStrictEqual(
      mine.map((t) => t.id),
      [idB],
    );
  });

  it("delete soft-revokes and a second delete is reported as NotFound", async () => {
    await insertUserRow(db);
    (await repo.insertOne(make(idA, "a", new Date()))).unwrap();
    (await repo.deleteOne(idA)).unwrap();
    const found = (await repo.findOne(ApiTokenSpecifications.withId(idA))).unwrap();
    if (found === null) throw new Error("expected a token");
    notStrictEqual(found.revokedAt, null);
    deepStrictEqual((await repo.deleteOne(idA)).unwrapErr()._tag, "ApiTokenNotFound");
  });

  it("update persists last_used_at for an active token", async () => {
    await insertUserRow(db);
    const now = new Date();
    const seed = make(idA, "a", now);
    (await repo.insertOne(seed)).unwrap();
    const later = new Date(now.getTime() + 2 * 3_600_000);
    (await repo.updateOne(ApiTokenRootOps.touch({ token: seed, now: later }))).unwrap();
    const found = (await repo.findOne(ApiTokenSpecifications.withId(idA))).unwrap();
    if (found === null) throw new Error("expected a token");
    deepStrictEqual(found.lastUsedAt, later);
    deepStrictEqual(found.expiresAt, seed.expiresAt);
  });
});
