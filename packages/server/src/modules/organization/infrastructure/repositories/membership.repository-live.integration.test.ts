import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { MembershipRootOps } from "@/modules/organization/domain/membership/membership.root-ops.js";
import { MembershipSpecifications } from "@/modules/organization/domain/membership/membership.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, runTestMigrations, truncate } from "@/test-utils/test-database.js";

import { MembershipRepositoryLive } from "./membership.repository-live.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const otherUserId = UserId.parse("22222222-2222-2222-2222-222222222222");
const organizationId = OrganizationId.parse("33333333-3333-3333-3333-333333333333");
const now = new Date("2026-01-01T00:00:00Z");

const byPair = (u: UserId, o: OrganizationId) =>
  Spec.and(MembershipSpecifications.forUser(u), MembershipSpecifications.forOrganization(o));

// memberships FK to "user".users and organization.organizations; neither
// sibling repository is this test's to reach, so the rows are seeded raw.
const seedFks = async (db: Database): Promise<void> => {
  await db.exec(sql.unsafe`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES (${userId}, 'alice@example.com', 'USA', '123 Main St', '12345', now(), now()),
           (${otherUserId}, 'bob@example.com', 'USA', '456 Main St', '12345', now(), now())
  `);
  await db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${organizationId}, 'Acme', now(), now(), NULL)
  `);
};

describe.sequential("MembershipRepositoryLive (integration)", () => {
  let db: Database;
  let repo: MembershipRepositoryLive;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
    repo = new MembershipRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "organization.memberships", "organization.organizations", "user.users");
    await seedFks(db);
  });

  describe("insert + findOne", () => {
    it("round-trips an inserted membership", async () => {
      const { membership } = MembershipRootOps.create({ userId, organizationId, now });
      (await repo.insertOne(membership)).unwrap();
      const found = (await repo.findOne(byPair(userId, organizationId))).unwrap();
      if (found === null) throw new Error("expected membership");
      deepStrictEqual(found.userId, userId);
      deepStrictEqual(found.organizationId, organizationId);
    });

    it("insert is idempotent: a second call with the same PK does not fail", async () => {
      const { membership } = MembershipRootOps.create({ userId, organizationId, now });
      (await repo.insertOne(membership)).unwrap();
      (await repo.insertOne(membership)).unwrap();
      const found = (await repo.findOne(byPair(userId, organizationId))).unwrap();
      deepStrictEqual(found?.userId, userId);
    });

    it("findOne returns null for an unknown pair", async () => {
      deepStrictEqual((await repo.findOne(byPair(otherUserId, organizationId))).unwrap(), null);
    });
  });

  describe("delete", () => {
    it("removes the row; a subsequent find returns null", async () => {
      const { membership } = MembershipRootOps.create({ userId, organizationId, now });
      (await repo.insertOne(membership)).unwrap();
      (await repo.deleteOne(userId, organizationId)).unwrap();
      deepStrictEqual((await repo.findOne(byPair(userId, organizationId))).unwrap(), null);
    });

    it("fails MembershipNotFound when no row exists", async () => {
      const result = await repo.deleteOne(userId, organizationId);
      deepStrictEqual(result.unwrapErr()._tag, "MembershipNotFound");
    });
  });
});
