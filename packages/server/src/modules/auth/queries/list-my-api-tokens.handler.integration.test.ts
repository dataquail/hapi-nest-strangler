import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { ApiTokenId } from "../domain/api-token/api-token.id.js";
import { ApiTokenRootOps } from "../domain/api-token/api-token.root-ops.js";
import { ApiTokenRepositoryLive } from "../infrastructure/repositories/api-token.repository-live.js";
import { ListMyApiTokensHandler } from "./list-my-api-tokens.handler.js";
import { ListMyApiTokensQuery } from "./list-my-api-tokens.query.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const otherUserId = UserId.parse("22222222-2222-2222-2222-222222222222");
const idA = ApiTokenId.parse("33333333-3333-3333-3333-333333333333");
const idOther = ApiTokenId.parse("44444444-4444-4444-4444-444444444444");
const now = new Date("2026-01-01T00:00:00Z");
const DAY_MS = 86_400_000;

const mint = (id: ApiTokenId, owner: UserId, tokenHash: string) =>
  ApiTokenRootOps.mint({
    id,
    userId: owner,
    tokenHash,
    prefix: "pat_abcd1234",
    label: "ci",
    now,
    expiresAt: new Date(now.getTime() + 90 * DAY_MS),
  });

const seedUsers = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES (${userId}, 'me@example.com', 'USA', '123 Main St', '12345', now(), now()),
           (${otherUserId}, 'other@example.com', 'USA', '456 Main St', '12345', now(), now())
  `);

describe.sequential("ListMyApiTokensHandler (integration)", () => {
  let db: Database;
  let repo: ApiTokenRepositoryLive;
  let handler: ListMyApiTokensHandler;

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new ApiTokenRepositoryLive(db);
    handler = new ListMyApiTokensHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "auth.api_tokens", "user.users");
  });

  it("returns only the caller's tokens, without the hash", async () => {
    await seedUsers(db);
    (await repo.insertOne(mint(idA, userId, "hash-a"))).unwrap();
    (await repo.insertOne(mint(idOther, otherUserId, "hash-other"))).unwrap();
    const mine = (await handler.execute(new ListMyApiTokensQuery({ userId }))).unwrap();
    deepStrictEqual(
      mine.map((t) => t.id),
      [idA],
    );
    deepStrictEqual("tokenHash" in (mine[0] ?? {}), false);
  });

  it("excludes revoked tokens", async () => {
    await seedUsers(db);
    (await repo.insertOne(mint(idA, userId, "hash-live"))).unwrap();
    (await repo.deleteOne(idA)).unwrap();
    const mine = (await handler.execute(new ListMyApiTokensQuery({ userId }))).unwrap();
    deepStrictEqual([...mine], []);
  });
});
