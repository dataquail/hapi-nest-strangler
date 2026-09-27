import { deepStrictEqual, ok } from "node:assert";

import { type Database, sql } from "@org/database";
import { describe, it } from "vitest";

import { MEMBER_CALLER, SUPER_ADMIN_CALLER_ID } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const TABLES = [
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
];
const ORG_ID = "11111111-1111-1111-1111-111111111111";
const TARGET_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const seedTargetUser = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES (${TARGET_ID}, 'target@test.local', 'USA', '3 St', '00000', now(), now())
    ON CONFLICT (id) DO NOTHING
  `);

const seedOrg = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${ORG_ID}, 'Acme', now(), now(), null)
  `);

const seedMembership = (db: Database, orgId: string) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".memberships (user_id, organization_id, created_at) VALUES (${TARGET_ID}, ${orgId}, now())
  `);

const promote = (orgId: string, userId: string) => ({ params: { path: { orgId, userId } } });

describe.sequential(
  "POST /orgs/{orgId}/members/{userId}/admin (integration, super-admin caller)",
  () => {
    const runtime = useServerTestRuntime(TABLES, { seedSuperAdminCaller: true });

    it("promotes a plain member, reflected as isAdmin in the members list", async () => {
      const { client, database } = runtime.server();
      await seedTargetUser(database);
      await seedOrg(database);
      await seedMembership(database, ORG_ID);
      const res = await client.POST(
        "/orgs/{orgId}/members/{userId}/admin",
        promote(ORG_ID, TARGET_ID),
      );
      deepStrictEqual(res.response.status, 204);
      const after = await client.GET("/orgs/{orgId}/members", {
        params: { path: { orgId: ORG_ID } },
      });
      const target = after.data?.members.find((m) => m.userId === TARGET_ID);
      ok(target !== undefined);
      deepStrictEqual(target.isAdmin, true);
    });

    it("returns 409 OrganizationRoleConflictError when already an admin", async () => {
      const { client, database } = runtime.server();
      await seedTargetUser(database);
      await seedOrg(database);
      await seedMembership(database, ORG_ID);
      await client.POST("/orgs/{orgId}/members/{userId}/admin", promote(ORG_ID, TARGET_ID));
      const res = await client.POST(
        "/orgs/{orgId}/members/{userId}/admin",
        promote(ORG_ID, TARGET_ID),
      );
      deepStrictEqual(res.response.status, 409);
      const error = res.error as { _tag: string; reason?: string } | undefined;
      deepStrictEqual(error?._tag, "OrganizationRoleConflictError");
      deepStrictEqual(error?.reason, "already_admin");
    });

    it("returns 403 Forbidden when the actor targets themselves", async () => {
      const { client, database } = runtime.server();
      await seedOrg(database);
      const res = await client.POST(
        "/orgs/{orgId}/members/{userId}/admin",
        promote(ORG_ID, SUPER_ADMIN_CALLER_ID),
      );
      deepStrictEqual(res.response.status, 403);
      deepStrictEqual(res.error?._tag, "Forbidden");
    });
  },
);

describe.sequential(
  "POST /orgs/{orgId}/members/{userId}/admin (integration, org-admin caller)",
  () => {
    const runtime = useServerTestRuntime(TABLES, {
      caller: MEMBER_CALLER,
      seedSuperAdminCaller: true,
    });

    it("lets an org admin (the creator) promote another member", async () => {
      const { client, database } = runtime.server();
      // The member caller creates the org and is auto-granted admin.
      const created = await client.POST("/orgs", { body: { name: "Acme" } });
      ok(created.data !== undefined, JSON.stringify(created.error));
      const orgId = created.data.id;
      await seedTargetUser(database);
      await seedMembership(database, orgId);
      const res = await client.POST(
        "/orgs/{orgId}/members/{userId}/admin",
        promote(orgId, TARGET_ID),
      );
      deepStrictEqual(res.response.status, 204);
      const after = await client.GET("/orgs/{orgId}/members", { params: { path: { orgId } } });
      const target = after.data?.members.find((m) => m.userId === TARGET_ID);
      ok(target !== undefined);
      deepStrictEqual(target.isAdmin, true);
    });

    it("returns 403 Forbidden when the caller is not an admin of the org", async () => {
      const { client, database } = runtime.server();
      await seedTargetUser(database);
      await seedOrg(database);
      const res = await client.POST(
        "/orgs/{orgId}/members/{userId}/admin",
        promote(ORG_ID, TARGET_ID),
      );
      deepStrictEqual(res.response.status, 403);
      deepStrictEqual(res.error?._tag, "Forbidden");
    });
  },
);
