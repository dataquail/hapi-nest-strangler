import { deepStrictEqual } from "node:assert";

import type { Database } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { UserRootOps } from "../domain/user/user.root-ops.js";
import { AddressValueObject } from "../domain/user/value-objects/address.value-object.js";
import { UserRepositoryLive } from "../infrastructure/repositories/user.repository-live.js";
import { FindUsersByIdsHandler } from "./find-users-by-ids.handler.js";
import { FindUsersByIdsQuery } from "./find-users-by-ids.query.js";

const address = AddressValueObject.parse({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});
const aliceId = UserId.parse("11111111-1111-1111-1111-111111111111");
const bobId = UserId.parse("22222222-2222-2222-2222-222222222222");
const carolId = UserId.parse("33333333-3333-3333-3333-333333333333");
const now = new Date("2025-01-01T00:00:00Z");

describe.sequential("FindUsersByIdsHandler (integration)", () => {
  let db: Database;
  let repo: UserRepositoryLive;
  let handler: FindUsersByIdsHandler;

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new UserRepositoryLive(db);
    handler = new FindUsersByIdsHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "user.users");
  });

  it("returns only the users whose ids are in the list", async () => {
    for (const [id, email] of [
      [aliceId, "alice@example.com"],
      [bobId, "bob@example.com"],
      [carolId, "carol@example.com"],
    ] as const) {
      (await repo.insertOne(UserRootOps.create({ id, email, address, now }).user)).unwrap();
    }
    const result = (
      await handler.execute(new FindUsersByIdsQuery({ ids: [aliceId, carolId] }))
    ).unwrap();
    deepStrictEqual(result.length, 2);
    deepStrictEqual(
      new Set(result.map((u) => u.email)),
      new Set(["alice@example.com", "carol@example.com"]),
    );
  });

  it("returns empty for an empty id list (no SQL dispatched)", async () => {
    deepStrictEqual((await handler.execute(new FindUsersByIdsQuery({ ids: [] }))).unwrap(), []);
  });
});
