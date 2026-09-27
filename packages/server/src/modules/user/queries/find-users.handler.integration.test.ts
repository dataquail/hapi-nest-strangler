import { deepStrictEqual } from "node:assert";

import type { Database } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { UserRootOps } from "../domain/user/user.root-ops.js";
import { AddressValueObject } from "../domain/user/value-objects/address.value-object.js";
import { UserRepositoryLive } from "../infrastructure/repositories/user.repository-live.js";
import { FindUsersHandler } from "./find-users.handler.js";
import { FindUsersQuery } from "./find-users.query.js";

const address = AddressValueObject.parse({
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
});

const aliceId = UserId.parse("11111111-1111-1111-1111-111111111111");
const bobId = UserId.parse("22222222-2222-2222-2222-222222222222");
const carolId = UserId.parse("33333333-3333-3333-3333-333333333333");

const aliceTime = new Date("2025-01-01T00:00:00Z");
const bobTime = new Date("2025-02-01T00:00:00Z");
const carolTime = new Date("2025-03-01T00:00:00Z");

describe.sequential("FindUsersHandler (integration)", () => {
  let db: Database;
  let repo: UserRepositoryLive;
  let handler: FindUsersHandler;

  const seed = async (id: UserId, email: string, now: Date) => {
    (await repo.insertOne(UserRootOps.create({ id, email, address, now }).user)).unwrap();
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new UserRepositoryLive(db);
    handler = new FindUsersHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "user.users");
  });

  it("returns rows ordered by created_at desc with paging metadata", async () => {
    await seed(aliceId, "alice@example.com", aliceTime);
    await seed(bobId, "bob@example.com", bobTime);
    await seed(carolId, "carol@example.com", carolTime);

    const result = (await handler.execute(new FindUsersQuery({ page: 1, pageSize: 2 }))).unwrap();
    deepStrictEqual(result.page, 1);
    deepStrictEqual(result.pageSize, 2);
    deepStrictEqual(result.total, 3);
    deepStrictEqual(result.users.length, 2);
    deepStrictEqual(
      result.users.map((u) => u.email),
      ["carol@example.com", "bob@example.com"],
    );
  });

  it("returns the correct page when offset", async () => {
    await seed(aliceId, "alice@example.com", aliceTime);
    await seed(bobId, "bob@example.com", bobTime);
    await seed(carolId, "carol@example.com", carolTime);

    const result = (await handler.execute(new FindUsersQuery({ page: 2, pageSize: 2 }))).unwrap();
    deepStrictEqual(result.total, 3);
    deepStrictEqual(result.users.length, 1);
    deepStrictEqual(result.users[0]?.email, "alice@example.com");
  });

  it("returns total 0 and empty users when the table is empty", async () => {
    const result = (await handler.execute(new FindUsersQuery({ page: 1, pageSize: 10 }))).unwrap();
    deepStrictEqual(result.total, 0);
    deepStrictEqual(result.users, []);
  });
});
