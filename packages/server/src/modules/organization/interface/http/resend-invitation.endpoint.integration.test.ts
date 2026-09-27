import { deepStrictEqual, ok } from "node:assert";

import { type Database, sql } from "@org/database";
import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const ORG_ID = "11111111-1111-1111-1111-111111111111";
const UNKNOWN_INVITATION_ID = "22222222-2222-2222-2222-222222222222";

const seedOrg = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${ORG_ID}, 'Acme', now(), now(), null)
  `);

describe.sequential("POST /orgs/{orgId}/invitations/{invitationId}/resend (integration)", () => {
  const runtime = useServerTestRuntime(
    ["organization.invitations", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
  );

  it("resends an open invitation and keeps it on the pending list", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    const invited = await client.POST("/orgs/{orgId}/invitations", {
      params: { path: { orgId: ORG_ID } },
      body: { email: "alice@example.com" },
    });
    ok(invited.data !== undefined, JSON.stringify(invited.error));
    const { invitationId } = invited.data;
    const res = await client.POST("/orgs/{orgId}/invitations/{invitationId}/resend", {
      params: { path: { orgId: ORG_ID, invitationId } },
    });
    deepStrictEqual(res.response.status, 204);
    // Still exactly one open invitation (a reissue, not a duplicate).
    const after = await client.GET("/orgs/{orgId}/invitations", {
      params: { path: { orgId: ORG_ID } },
    });
    deepStrictEqual(after.data?.invitations.length, 1);
    deepStrictEqual(after.data?.invitations[0]?.invitationId, invitationId);
  });

  it("returns 404 for an unknown invitation", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    const res = await client.POST("/orgs/{orgId}/invitations/{invitationId}/resend", {
      params: { path: { orgId: ORG_ID, invitationId: UNKNOWN_INVITATION_ID } },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "InvitationNotFoundError");
  });
});
