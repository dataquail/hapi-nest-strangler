import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { RolesRootOps } from "../domain/roles/roles.root-ops.js";
import { RolesRepositoryLive } from "../infrastructure/repositories/roles.repository-live.js";
import { FindUserRolesHandler } from "./find-user-roles.handler.js";
import { FindUserRolesQuery } from "./find-user-roles.policy-query.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");

describe.sequential("FindUserRolesHandler (integration)", () => {
  let db: Database;
  let repo: RolesRepositoryLive;
  let handler: FindUserRolesHandler;

  const seedUser = async () => {
    await db.exec(sql.unsafe`
      INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
      VALUES (${userId}, 'member@example.com', 'USA', '1 St', '12345', now(), now())
    `);
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new RolesRepositoryLive(db);
    handler = new FindUserRolesHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "platform.roles", "user.users");
  });

  it("returns an empty role array for a user with none granted", async () => {
    await seedUser();
    const result = (await handler.execute(new FindUserRolesQuery({ userId }))).unwrap();
    deepStrictEqual(result.userId, userId);
    deepStrictEqual([...result.roles], []);
  });

  it("returns the granted roles", async () => {
    await seedUser();
    const granted = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin").unwrap();
    (await repo.upsertOne(granted.roles)).unwrap();
    const result = (await handler.execute(new FindUserRolesQuery({ userId }))).unwrap();
    deepStrictEqual([...result.roles], ["super_admin"]);
  });
});
