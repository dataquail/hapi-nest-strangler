import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { ApiTokenId } from "../domain/api-token/api-token.id.js";
import { ApiTokenRootOps } from "../domain/api-token/api-token.root-ops.js";
import { ApiTokenRepositoryLive } from "../infrastructure/repositories/api-token.repository-live.js";
import { FindApiTokenByHashHandler } from "./find-api-token-by-hash.handler.js";
import { FindApiTokenByHashQuery } from "./find-api-token-by-hash.query.js";

const apiTokenId = ApiTokenId.parse("11111111-1111-1111-1111-111111111111");
const userId = UserId.parse("22222222-2222-2222-2222-222222222222");
const future = new Date("2099-01-01T00:00:00Z");
const past = new Date("2020-01-01T00:00:00Z");

const seedUser = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES (${userId}, 'owner@example.com', 'USA', '123 Main St', '12345', now(), now())
  `);

describe.sequential("FindApiTokenByHashHandler (integration)", () => {
  let db: Database;
  let repo: ApiTokenRepositoryLive;
  let handler: FindApiTokenByHashHandler;

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new ApiTokenRepositoryLive(db);
    handler = new FindApiTokenByHashHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "auth.api_tokens", "user.users");
  });

  const insert = async (options: { expiresAt: Date | null; revoked?: boolean }) => {
    await seedUser(db);
    const token = ApiTokenRootOps.mint({
      id: apiTokenId,
      userId,
      tokenHash: "hash-A",
      prefix: "pat_abcd1234",
      label: "ci",
      expiresAt: options.expiresAt,
      now: new Date(),
    });
    (await repo.insertOne(token)).unwrap();
    if (options.revoked === true) (await repo.deleteOne(apiTokenId)).unwrap();
  };

  it("returns an active token", async () => {
    await insert({ expiresAt: future });
    const result = await handler.execute(new FindApiTokenByHashQuery({ tokenHash: "hash-A" }));
    deepStrictEqual(result.unwrap(), { id: apiTokenId, userId });
  });

  it("returns a token with no expiry", async () => {
    await insert({ expiresAt: null });
    const result = await handler.execute(new FindApiTokenByHashQuery({ tokenHash: "hash-A" }));
    deepStrictEqual(result.unwrap().id, apiTokenId);
  });

  it("fails ApiTokenNotFound for an unknown hash", async () => {
    const result = await handler.execute(new FindApiTokenByHashQuery({ tokenHash: "missing" }));
    deepStrictEqual(result.unwrapErr()._tag, "ApiTokenNotFound");
  });

  it("fails ApiTokenRevoked when the token is revoked", async () => {
    await insert({ expiresAt: future, revoked: true });
    const result = await handler.execute(new FindApiTokenByHashQuery({ tokenHash: "hash-A" }));
    deepStrictEqual(result.unwrapErr()._tag, "ApiTokenRevoked");
  });

  it("fails ApiTokenExpired when past the expiry instant", async () => {
    await insert({ expiresAt: past });
    const result = await handler.execute(new FindApiTokenByHashQuery({ tokenHash: "hash-A" }));
    deepStrictEqual(result.unwrapErr()._tag, "ApiTokenExpired");
  });
});
