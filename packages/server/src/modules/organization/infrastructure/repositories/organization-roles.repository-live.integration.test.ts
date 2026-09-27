import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles/organization-roles.root-ops.js";
import { OrganizationRolesSpecifications } from "@/modules/organization/domain/organization-roles/organization-roles.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, runTestMigrations, truncate } from "@/test-utils/test-database.js";

import { OrganizationRolesRepositoryLive } from "./organization-roles.repository-live.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const issuedBy = UserId.parse("99999999-9999-9999-9999-999999999999");

const forPair = Spec.and(
  OrganizationRolesSpecifications.forUser(userId),
  OrganizationRolesSpecifications.forOrganization(orgId),
);

// organization_roles FKs to "user".users twice (user_id, issued_by) and to
// organization.organizations; the rows are seeded raw.
const seedFixtures = async (db: Database): Promise<void> => {
  await db.exec(sql.unsafe`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES (${userId}, 'alice@example.com', 'USA', '123 Main St', '12345', now(), now()),
           (${issuedBy}, 'admin@example.com', 'USA', '1 Admin Way', '12345', now(), now())
  `);
  await db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${orgId}, 'Acme', now(), now(), null)
  `);
};

describe.sequential("OrganizationRolesRepositoryLive (integration)", () => {
  let db: Database;
  let repo: OrganizationRolesRepositoryLive;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
    repo = new OrganizationRolesRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(
      db,
      "organization.organization_roles",
      "organization.organizations",
      "user.users",
    );
    await seedFixtures(db);
  });

  describe("findOne", () => {
    it("returns null when no rows exist (the empty case is the caller's)", async () => {
      deepStrictEqual((await repo.findOne(forPair)).unwrap(), null);
    });
  });

  describe("upsert", () => {
    it("persists granted roles with the issuedBy audit and round-trips", async () => {
      const granted = OrganizationRolesRootOps.grantRole(
        OrganizationRolesRootOps.empty(userId, orgId),
        "admin",
        issuedBy,
      ).unwrap();
      (await repo.upsertOne(granted.organizationRoles)).unwrap();
      const fetched = (await repo.findOne(forPair)).unwrap();
      if (fetched === null) throw new Error("expected aggregate");
      deepStrictEqual(
        fetched.roles.map((r) => ({ role: r.role, issuedBy: r.issuedBy })),
        [{ role: "admin", issuedBy }],
      );
    });

    it("replaces existing rows when an aggregate revokes a role", async () => {
      const granted = OrganizationRolesRootOps.grantRole(
        OrganizationRolesRootOps.empty(userId, orgId),
        "admin",
        issuedBy,
      ).unwrap();
      (await repo.upsertOne(granted.organizationRoles)).unwrap();
      const revoked = OrganizationRolesRootOps.revokeRole(
        granted.organizationRoles,
        "admin",
      ).unwrap();
      (await repo.upsertOne(revoked.organizationRoles)).unwrap();
      // Revoking the last role deletes every row: no rows reads as no aggregate.
      deepStrictEqual((await repo.findOne(forPair)).unwrap(), null);
    });
  });
});
