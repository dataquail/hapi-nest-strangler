import { deepStrictEqual, ok } from "node:assert";

import { type Database, sql } from "@org/database";
import { describe, it } from "vitest";

import { MEMBER_CALLER } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const TABLES = [
  "organization.invitations",
  "organization.organizations",
  "platform.roles",
  "user.users",
];
const ORG_ID = "11111111-1111-1111-1111-111111111111";
const UNKNOWN_ORG_ID = "99999999-9999-9999-9999-999999999999";

const seedOrg = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${ORG_ID}, 'Acme', now(), now(), null)
  `);

const inviteAlice = (orgId: string) => ({
  params: { path: { orgId } },
  body: { email: "alice@example.com" },
});

describe.sequential("POST /orgs/{orgId}/invitations (integration, super-admin caller)", () => {
  const runtime = useServerTestRuntime(TABLES, { seedSuperAdminCaller: true });

  it("creates a pending invitation for the invitee email", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    const invited = await client.POST("/orgs/{orgId}/invitations", inviteAlice(ORG_ID));
    ok(invited.data !== undefined, JSON.stringify(invited.error));
    const res = await client.GET("/orgs/{orgId}/invitations", {
      params: { path: { orgId: ORG_ID } },
    });
    deepStrictEqual(res.data?.invitations.length, 1);
    const invitation = res.data?.invitations[0];
    ok(invitation !== undefined);
    deepStrictEqual(invitation.invitationId, invited.data.invitationId);
    deepStrictEqual(invitation.inviteeEmail, "alice@example.com");
    deepStrictEqual(invitation.status, "pending");
  });

  it("re-inviting the same email reissues rather than duplicating", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    await client.POST("/orgs/{orgId}/invitations", inviteAlice(ORG_ID));
    await client.POST("/orgs/{orgId}/invitations", inviteAlice(ORG_ID));
    const res = await client.GET("/orgs/{orgId}/invitations", {
      params: { path: { orgId: ORG_ID } },
    });
    deepStrictEqual(res.data?.invitations.length, 1);
  });

  it("returns 404 when the organization does not exist", async () => {
    const res = await runtime
      .server()
      .client.POST("/orgs/{orgId}/invitations", inviteAlice(UNKNOWN_ORG_ID));
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "OrganizationNotFoundError");
  });
});

describe.sequential("POST /orgs/{orgId}/invitations (integration, non-admin member caller)", () => {
  const runtime = useServerTestRuntime(TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("forbids a member who is not an org admin from inviting", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    const res = await client.POST("/orgs/{orgId}/invitations", inviteAlice(ORG_ID));
    deepStrictEqual(res.response.status, 403);
    deepStrictEqual(res.error?._tag, "Forbidden");
  });
});
