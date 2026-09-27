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
import { FindMyOrganizationsHandler } from "./find-my-organizations.handler.js";
import { FindMyOrganizationsQuery } from "./find-my-organizations.query.js";

const aliceId = UserId.parse("11111111-1111-1111-1111-111111111111");
const bobId = UserId.parse("22222222-2222-2222-2222-222222222222");
const acmeId = OrganizationId.parse("33333333-3333-3333-3333-333333333333");
const betaId = OrganizationId.parse("44444444-4444-4444-4444-444444444444");
const now = new Date("2026-01-01T00:00:00Z");

describe.sequential("FindMyOrganizationsHandler (integration)", () => {
  let db: Database;
  let orgs: OrganizationRepositoryLive;
  let memberships: MembershipRepositoryLive;
  let handler: FindMyOrganizationsHandler;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
    orgs = new OrganizationRepositoryLive(db);
    memberships = new MembershipRepositoryLive(db);
    handler = new FindMyOrganizationsHandler(db);
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
      VALUES (${aliceId}, 'alice@example.com', 'USA', '123 Main St', '12345', now(), now()),
             (${bobId}, 'bob@example.com', 'USA', '456 Main St', '12345', now(), now())
    `);
  });

  const seedOrg = async (id: OrganizationId, name: string) => {
    const { organization } = OrganizationRootOps.create({ id, name, now });
    (await orgs.insertOne(organization)).unwrap();
    return organization;
  };
  const seedMember = async (userId: UserId, organizationId: OrganizationId) => {
    (
      await memberships.insertOne(
        MembershipRootOps.create({ userId, organizationId, now }).membership,
      )
    ).unwrap();
  };
  const mine = async () =>
    (await handler.execute(new FindMyOrganizationsQuery({ userId: aliceId }))).unwrap();

  it("returns only orgs the caller is a member of", async () => {
    await seedOrg(acmeId, "Acme");
    await seedOrg(betaId, "Beta");
    await seedMember(aliceId, acmeId);
    // Bob is a member of Beta, not Acme: must not leak into Alice's view.
    await seedMember(bobId, betaId);
    deepStrictEqual(
      (await mine()).organizations.map((o) => o.name),
      ["Acme"],
    );
  });

  it("flags orgs where the caller holds the admin role", async () => {
    await seedOrg(acmeId, "Acme");
    await seedOrg(betaId, "Beta");
    await seedMember(aliceId, acmeId);
    await seedMember(aliceId, betaId);
    await db.exec(sql.unsafe`
      INSERT INTO "organization".organization_roles (organization_id, user_id, role, issued_by, created_at)
      VALUES (${acmeId}, ${aliceId}, 'admin', ${aliceId}, now())
    `);
    const isAdminByName = new Map((await mine()).organizations.map((o) => [o.name, o.isAdmin]));
    deepStrictEqual(isAdminByName.get("Acme"), true);
    deepStrictEqual(isAdminByName.get("Beta"), false);
  });

  it("returns an empty list when the caller has no memberships", async () => {
    deepStrictEqual([...(await mine()).organizations], []);
  });

  it("hides soft-deleted orgs", async () => {
    const acme = await seedOrg(acmeId, "Acme");
    await seedMember(aliceId, acmeId);
    const deleted = OrganizationRootOps.softDelete(acme, { now }).unwrap();
    (await orgs.updateOne(deleted.organization)).unwrap();
    deepStrictEqual([...(await mine()).organizations], []);
  });
});
