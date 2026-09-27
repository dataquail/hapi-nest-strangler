import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, runTestMigrations, truncate } from "@/test-utils/test-database.js";

import { MembershipRootOps } from "../domain/membership/membership.root-ops.js";
import { OrganizationRootOps } from "../domain/organization/organization.root-ops.js";
import { MembershipRepositoryLive } from "../infrastructure/repositories/membership.repository-live.js";
import { OrganizationRepositoryLive } from "../infrastructure/repositories/organization.repository-live.js";
import { FindMembershipHandler } from "./find-membership.handler.js";
import { FindMembershipQuery } from "./find-membership.policy-query.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const now = new Date("2025-01-01T00:00:00Z");

describe.sequential("FindMembershipHandler (integration)", () => {
  let db: Database;
  let memberships: MembershipRepositoryLive;
  let handler: FindMembershipHandler;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
    memberships = new MembershipRepositoryLive(db);
    handler = new FindMembershipHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "organization.memberships", "organization.organizations", "user.users");
    await db.exec(sql.unsafe`
      INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
      VALUES (${userId}, 'member@example.com', 'USA', '123 Main St', '12345', now(), now())
    `);
    (
      await new OrganizationRepositoryLive(db).insertOne(
        OrganizationRootOps.create({ id: orgId, name: "Acme", now }).organization,
      )
    ).unwrap();
  });

  it("returns isMember=false when no membership row exists", async () => {
    const result = (
      await handler.execute(new FindMembershipQuery({ userId, organizationId: orgId }))
    ).unwrap();
    deepStrictEqual(result.isMember, false);
  });

  it("returns isMember=true once the membership exists", async () => {
    (
      await memberships.insertOne(
        MembershipRootOps.create({ userId, organizationId: orgId, now }).membership,
      )
    ).unwrap();
    const result = (
      await handler.execute(new FindMembershipQuery({ userId, organizationId: orgId }))
    ).unwrap();
    deepStrictEqual(result.isMember, true);
  });
});
