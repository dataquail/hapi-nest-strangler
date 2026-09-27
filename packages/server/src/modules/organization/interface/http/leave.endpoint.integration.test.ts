import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { describe, it } from "vitest";

import { SUPER_ADMIN_CALLER_ID } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const ORG_ID = "11111111-1111-1111-1111-111111111111";

const seedOrg = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${ORG_ID}, 'Acme', now(), now(), null)
  `);

const seedCallerMembership = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".memberships (user_id, organization_id, created_at)
    VALUES (${SUPER_ADMIN_CALLER_ID}, ${ORG_ID}, now())
  `);

const path = { params: { path: { orgId: ORG_ID } } };

describe.sequential("POST /orgs/{orgId}/leave (integration)", () => {
  const runtime = useServerTestRuntime(
    ["organization.memberships", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
  );

  it("removes the caller's membership", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    await seedCallerMembership(database);
    const res = await client.POST("/orgs/{orgId}/leave", path);
    deepStrictEqual(res.response.status, 204);
    const after = await client.GET("/orgs/{orgId}/members", path);
    deepStrictEqual(
      after.data?.members.some((m) => m.userId === SUPER_ADMIN_CALLER_ID),
      false,
    );
  });

  it("returns 404 when the caller is not a member", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    const res = await client.POST("/orgs/{orgId}/leave", path);
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "MembershipNotFoundError");
  });
});
