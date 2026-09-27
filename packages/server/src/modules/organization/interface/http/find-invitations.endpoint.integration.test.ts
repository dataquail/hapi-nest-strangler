import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const ORG_ID = "11111111-1111-1111-1111-111111111111";

const seedOrg = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${ORG_ID}, 'Acme', now(), now(), null)
  `);

describe.sequential("GET /orgs/{orgId}/invitations (integration)", () => {
  const runtime = useServerTestRuntime(
    ["organization.invitations", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
  );

  it("lists open invitations as pending", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    // Seeded via the production invite path, not raw SQL.
    const invited = await client.POST("/orgs/{orgId}/invitations", {
      params: { path: { orgId: ORG_ID } },
      body: { email: "alice@example.com" },
    });
    deepStrictEqual(invited.response.status, 201, JSON.stringify(invited.error));
    const res = await client.GET("/orgs/{orgId}/invitations", {
      params: { path: { orgId: ORG_ID } },
    });
    deepStrictEqual(res.data?.invitations.length, 1);
    const invitation = res.data?.invitations[0];
    if (invitation === undefined) throw new Error("expected one invitation");
    deepStrictEqual(invitation.inviteeEmail, "alice@example.com");
    deepStrictEqual(invitation.status, "pending");
  });

  it("returns an empty list for an org with no invitations", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    const res = await client.GET("/orgs/{orgId}/invitations", {
      params: { path: { orgId: ORG_ID } },
    });
    deepStrictEqual(res.data?.invitations.length, 0);
  });
});
