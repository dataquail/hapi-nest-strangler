import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, runTestMigrations, truncate } from "@/test-utils/test-database.js";

import { OrganizationRootOps } from "../domain/organization/organization.root-ops.js";
import { OrganizationRolesRootOps } from "../domain/organization-roles/organization-roles.root-ops.js";
import { OrganizationRepositoryLive } from "../infrastructure/repositories/organization.repository-live.js";
import { OrganizationRolesRepositoryLive } from "../infrastructure/repositories/organization-roles.repository-live.js";
import { FindUserOrganizationRolesHandler } from "./find-user-organization-roles.handler.js";
import { FindUserOrganizationRolesQuery } from "./find-user-organization-roles.policy-query.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const issuedBy = UserId.parse("99999999-9999-9999-9999-999999999999");
const now = new Date("2025-01-01T00:00:00Z");

describe.sequential("FindUserOrganizationRolesHandler (integration)", () => {
  let db: Database;
  let roles: OrganizationRolesRepositoryLive;
  let handler: FindUserOrganizationRolesHandler;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
    roles = new OrganizationRolesRepositoryLive(db);
    handler = new FindUserOrganizationRolesHandler(db);
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
    await db.exec(sql.unsafe`
      INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
      VALUES (${userId}, 'member@example.com', 'USA', '1 St', '12345', now(), now()),
             (${issuedBy}, 'issuer@example.com', 'USA', '2 St', '12345', now(), now())
    `);
    (
      await new OrganizationRepositoryLive(db).insertOne(
        OrganizationRootOps.create({ id: orgId, name: "Acme", now }).organization,
      )
    ).unwrap();
  });

  it("returns an empty roles array for a (user, org) with none granted", async () => {
    const result = (
      await handler.execute(new FindUserOrganizationRolesQuery({ userId, organizationId: orgId }))
    ).unwrap();
    deepStrictEqual(result.userId, userId);
    deepStrictEqual(result.organizationId, orgId);
    deepStrictEqual([...result.roles], []);
  });

  it("returns the granted roles, projected to bare role names", async () => {
    const granted = OrganizationRolesRootOps.grantRole(
      OrganizationRolesRootOps.empty(userId, orgId),
      "admin",
      issuedBy,
    ).unwrap();
    (await roles.upsertOne(granted.organizationRoles)).unwrap();
    const result = (
      await handler.execute(new FindUserOrganizationRolesQuery({ userId, organizationId: orgId }))
    ).unwrap();
    deepStrictEqual([...result.roles], ["admin"]);
  });
});
