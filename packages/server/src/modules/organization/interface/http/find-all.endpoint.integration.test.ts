import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { describe, it } from "vitest";

import { MEMBER_CALLER } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

// Listing all orgs is super-admin-only, and super-admins cannot create orgs,
// so the orgs to list are seeded: "Acme" active, "Beta" tombstoned.
const seedOrgs = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES ('11111111-1111-1111-1111-111111111111', 'Acme', now(), now(), null),
           ('22222222-2222-2222-2222-222222222222', 'Beta', now(), now(), now())
  `);

describe.sequential("GET /admin/orgs (integration)", () => {
  const runtime = useServerTestRuntime(
    ["organization.memberships", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
  );

  it("returns created orgs (active-only by default)", async () => {
    const { client, database } = runtime.server();
    await seedOrgs(database);
    const res = await client.GET("/admin/orgs", { params: { query: { page: 1, pageSize: 10 } } });
    deepStrictEqual(res.data?.total, 1);
    deepStrictEqual(res.data?.organizations[0]?.name, "Acme");
  });

  it("returns tombstoned orgs when includeDeleted=true", async () => {
    const { client, database } = runtime.server();
    await seedOrgs(database);
    const res = await client.GET("/admin/orgs", {
      params: { query: { page: 1, pageSize: 10, includeDeleted: "true" } },
    });
    deepStrictEqual(res.data?.total, 2);
  });
});

describe.sequential("GET /admin/orgs (integration, non-super-admin caller)", () => {
  const runtime = useServerTestRuntime(["organization.organizations", "platform.roles"], {
    caller: MEMBER_CALLER,
  });

  it("returns 403 Forbidden", async () => {
    const res = await runtime
      .server()
      .client.GET("/admin/orgs", { params: { query: { page: 1, pageSize: 10 } } });
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
