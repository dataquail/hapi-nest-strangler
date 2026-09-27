import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { RolesRootOps } from "@/modules/role/domain/roles/roles.root-ops.js";
import { RolesSpecifications } from "@/modules/role/domain/roles/roles.specification.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { RolesRepositoryLive } from "./roles.repository-live.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");

const forUser = RolesSpecifications.forUser(userId);

describe.sequential("RolesRepositoryLive (integration)", () => {
  let db: Database;
  let repo: RolesRepositoryLive;

  // platform.roles FKs to user.users(id); the FK row is seeded by raw SQL since
  // this module may not reach the user module's repository.
  const seedUser = async () => {
    await db.exec(sql.unsafe`
      INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
      VALUES (${userId}, 'alice@example.com', 'USA', '123 Main St', '12345', now(), now())
    `);
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new RolesRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "platform.roles", "user.users");
  });

  describe("findOne", () => {
    it("returns null when no rows exist (the empty case is the caller's)", async () => {
      await seedUser();
      deepStrictEqual((await repo.findOne(forUser)).unwrap(), null);
    });
  });

  describe("save", () => {
    it("persists granted roles and round-trips via findOne", async () => {
      await seedUser();
      const granted = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin").unwrap();
      (await repo.upsertOne(granted.roles)).unwrap();
      const fetched = (await repo.findOne(forUser)).unwrap();
      if (fetched === null) throw new Error("expected aggregate");
      deepStrictEqual([...fetched.roles], ["super_admin"]);
    });

    it("replaces existing rows when an aggregate revokes a role", async () => {
      await seedUser();
      const granted = RolesRootOps.grant(RolesRootOps.empty(userId), "super_admin").unwrap();
      (await repo.upsertOne(granted.roles)).unwrap();
      const revoked = RolesRootOps.revoke(granted.roles, "super_admin").unwrap();
      (await repo.upsertOne(revoked.roles)).unwrap();
      // Revoking the last role deletes every row: nothing to reconstitute.
      deepStrictEqual((await repo.findOne(forUser)).unwrap(), null);
    });
  });
});
