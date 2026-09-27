import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, runTestMigrations, truncate } from "@/test-utils/test-database.js";

import { MembershipRootOps } from "../domain/membership/membership.root-ops.js";
import { OrganizationRootOps } from "../domain/organization/organization.root-ops.js";
import { OrganizationRolesRootOps } from "../domain/organization-roles/organization-roles.root-ops.js";
import { UsersLookupFake } from "../infrastructure/acl/users-lookup.acl-fake.js";
import { MembershipRepositoryLive } from "../infrastructure/repositories/membership.repository-live.js";
import { OrganizationRepositoryLive } from "../infrastructure/repositories/organization.repository-live.js";
import { OrganizationRolesRepositoryLive } from "../infrastructure/repositories/organization-roles.repository-live.js";
import { FindOrganizationMembershipsHandler } from "./find-organization-memberships.handler.js";
import { FindOrganizationMembershipsQuery } from "./find-organization-memberships.query.js";

const orgA = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const orgB = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const userA = UserId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const userB = UserId.parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const userC = UserId.parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
const orphanedUser = UserId.parse("99999999-9999-9999-9999-999999999999");
const issuer = UserId.parse("99999999-9999-9999-9999-999999999990");
const now = new Date("2026-01-01T00:00:00Z");

// The membership and roles reads hit the real DB; email enrichment goes
// through the UsersLookup port, here the in-memory fake seeded to match.
const usersLookup = new UsersLookupFake([
  { userId: userA, email: "a@example.com" },
  { userId: userB, email: "b@example.com" },
  { userId: userC, email: "c@example.com" },
]);

describe.sequential("FindOrganizationMembershipsHandler (integration)", () => {
  let db: Database;
  let memberships: MembershipRepositoryLive;
  let roles: OrganizationRolesRepositoryLive;
  let handler: FindOrganizationMembershipsHandler;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
    memberships = new MembershipRepositoryLive(db);
    roles = new OrganizationRolesRepositoryLive(db);
    handler = new FindOrganizationMembershipsHandler(db, usersLookup);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(
      db,
      "organization.organization_roles",
      "organization.memberships",
      "organization.organizations",
      "user.users",
    );
    await db.exec(sql.unsafe`
      INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
      VALUES (${userA}, 'a@example.com', 'USA', '1 St', '12345', now(), now()),
             (${userB}, 'b@example.com', 'USA', '2 St', '12345', now(), now()),
             (${userC}, 'c@example.com', 'USA', '3 St', '12345', now(), now()),
             (${orphanedUser}, 'orphan@example.com', 'USA', '4 St', '12345', now(), now()),
             (${issuer}, 'issuer@example.com', 'USA', '5 St', '12345', now(), now())
    `);
    const orgs = new OrganizationRepositoryLive(db);
    (
      await orgs.insertOne(OrganizationRootOps.create({ id: orgA, name: "Acme", now }).organization)
    ).unwrap();
    (
      await orgs.insertOne(OrganizationRootOps.create({ id: orgB, name: "Beta", now }).organization)
    ).unwrap();
  });

  const seedMember = async (userId: UserId, organizationId: OrganizationId) => {
    (
      await memberships.insertOne(
        MembershipRootOps.create({ userId, organizationId, now }).membership,
      )
    ).unwrap();
  };
  const seedAdmin = async (userId: UserId, organizationId: OrganizationId) => {
    const granted = OrganizationRolesRootOps.grantRole(
      OrganizationRolesRootOps.empty(userId, organizationId),
      "admin",
      issuer,
    ).unwrap();
    (await roles.upsertOne(granted.organizationRoles)).unwrap();
  };
  const membersOfA = async () =>
    (
      await handler.execute(new FindOrganizationMembershipsQuery({ organizationId: orgA }))
    ).unwrap();

  it("returns only the requested org's members, enriched with email", async () => {
    await seedMember(userA, orgA);
    await seedMember(userB, orgA);
    await seedMember(userC, orgB);
    const result = await membersOfA();
    deepStrictEqual(result.length, 2);
    deepStrictEqual(
      new Set(result.map((r) => r.email)),
      new Set(["a@example.com", "b@example.com"]),
    );
  });

  it("flags admins via isAdmin and leaves plain members false", async () => {
    await seedMember(userA, orgA);
    await seedMember(userB, orgA);
    await seedAdmin(userA, orgA);
    const byUser = new Map((await membersOfA()).map((r) => [r.userId, r.isAdmin]));
    deepStrictEqual(byUser.get(userA), true);
    deepStrictEqual(byUser.get(userB), false);
  });

  it("returns empty when the org has no members", async () => {
    deepStrictEqual(await membersOfA(), []);
  });

  it("skips members whose user record is missing from the lookup", async () => {
    await seedMember(userA, orgA);
    await seedMember(orphanedUser, orgA);
    const result = await membersOfA();
    deepStrictEqual(result.length, 1);
    deepStrictEqual(
      result.map((r) => r.userId),
      [userA],
    );
  });
});
