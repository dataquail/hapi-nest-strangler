import { deepStrictEqual, ok } from "node:assert";

import { type Database, sql } from "@org/database";
import { describe, it } from "vitest";

import {
  MEMBER_CALLER,
  MEMBER_CALLER_ID,
  SUPER_ADMIN_CALLER_ID,
} from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const TABLES = [
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
];
const ORG_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_MEMBER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const seedOrg = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${ORG_ID}, 'Acme', now(), now(), null)
  `);

// No single-caller HTTP path assembles a multi-member org (create rejects
// super-admins, accept needs the invitee's own session), so the rows are seeded.
const seedOrgWithMembers = async (db: Database): Promise<void> => {
  await db.exec(sql.unsafe`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES (${ADMIN_MEMBER_ID}, 'admin-member@test.local', 'USA', '3 St', '00000', now(), now())
    ON CONFLICT (id) DO NOTHING
  `);
  await seedOrg(db);
  await db.exec(sql.unsafe`
    INSERT INTO "organization".memberships (user_id, organization_id, created_at)
    VALUES (${MEMBER_CALLER_ID}, ${ORG_ID}, now()), (${ADMIN_MEMBER_ID}, ${ORG_ID}, now())
  `);
  await db.exec(sql.unsafe`
    INSERT INTO "organization".organization_roles (organization_id, user_id, role, issued_by, created_at)
    VALUES (${ORG_ID}, ${ADMIN_MEMBER_ID}, 'admin', ${SUPER_ADMIN_CALLER_ID}, now())
  `);
};

const path = { params: { path: { orgId: ORG_ID } } };

describe.sequential("GET /orgs/{orgId}/members (integration, super-admin caller)", () => {
  const runtime = useServerTestRuntime(TABLES, { seedSuperAdminCaller: true });

  it("lists members enriched with email and the isAdmin flag", async () => {
    const { client, database } = runtime.server();
    await seedOrgWithMembers(database);
    const res = await client.GET("/orgs/{orgId}/members", path);
    deepStrictEqual(res.data?.members.length, 2);
    const byId = new Map(res.data?.members.map((m) => [m.userId, m]));
    const plain = byId.get(MEMBER_CALLER_ID);
    const admin = byId.get(ADMIN_MEMBER_ID);
    ok(plain !== undefined && admin !== undefined);
    deepStrictEqual(plain.email, "member@test.local");
    deepStrictEqual(plain.isAdmin, false);
    deepStrictEqual(admin.email, "admin-member@test.local");
    deepStrictEqual(admin.isAdmin, true);
  });
});

describe.sequential("GET /orgs/{orgId}/members (integration, plain-member caller)", () => {
  const runtime = useServerTestRuntime(TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("lets a plain member (no admin role) read the roster", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    await database.exec(sql.unsafe`
      INSERT INTO "organization".memberships (user_id, organization_id, created_at) VALUES (${MEMBER_CALLER_ID}, ${ORG_ID}, now())
    `);
    const res = await client.GET("/orgs/{orgId}/members", path);
    deepStrictEqual(res.data?.members.length, 1);
    const self = res.data?.members[0];
    ok(self !== undefined);
    deepStrictEqual(self.userId, MEMBER_CALLER_ID);
    deepStrictEqual(self.isAdmin, false);
  });

  it("returns 403 Forbidden for a caller who is not a member of the org", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    const res = await client.GET("/orgs/{orgId}/members", path);
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
