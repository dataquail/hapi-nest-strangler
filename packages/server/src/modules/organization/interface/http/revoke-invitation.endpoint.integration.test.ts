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
const UNKNOWN_INVITATION_ID = "22222222-2222-2222-2222-222222222222";

const seedOrg = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${ORG_ID}, 'Acme', now(), now(), null)
  `);

const revoke = (invitationId: string) => ({ params: { path: { orgId: ORG_ID, invitationId } } });

describe.sequential(
  "DELETE /orgs/{orgId}/invitations/{invitationId} (integration, super-admin caller)",
  () => {
    const runtime = useServerTestRuntime(TABLES, { seedSuperAdminCaller: true });

    const inviteAlice = async (): Promise<string> => {
      const invited = await runtime.server().client.POST("/orgs/{orgId}/invitations", {
        params: { path: { orgId: ORG_ID } },
        body: { email: "alice@example.com" },
      });
      ok(invited.data !== undefined, JSON.stringify(invited.error));
      return invited.data.invitationId;
    };

    it("revokes a pending invitation so it drops off the pending list", async () => {
      const { client, database } = runtime.server();
      await seedOrg(database);
      const invitationId = await inviteAlice();
      const res = await client.DELETE(
        "/orgs/{orgId}/invitations/{invitationId}",
        revoke(invitationId),
      );
      deepStrictEqual(res.response.status, 204);
      const after = await client.GET("/orgs/{orgId}/invitations", {
        params: { path: { orgId: ORG_ID } },
      });
      deepStrictEqual(after.data?.invitations.length, 0);
    });

    it("returns 410 Gone when the invitation is already revoked", async () => {
      const { client, database } = runtime.server();
      await seedOrg(database);
      const invitationId = await inviteAlice();
      await client.DELETE("/orgs/{orgId}/invitations/{invitationId}", revoke(invitationId));
      const res = await client.DELETE(
        "/orgs/{orgId}/invitations/{invitationId}",
        revoke(invitationId),
      );
      deepStrictEqual(res.response.status, 410);
      const error = res.error as { _tag: string; reason?: string } | undefined;
      deepStrictEqual(error?._tag, "InvitationGoneError");
      deepStrictEqual(error?.reason, "revoked");
    });

    it("returns 404 for an unknown invitation", async () => {
      const { client, database } = runtime.server();
      await seedOrg(database);
      const res = await client.DELETE(
        "/orgs/{orgId}/invitations/{invitationId}",
        revoke(UNKNOWN_INVITATION_ID),
      );
      deepStrictEqual(res.response.status, 404);
      deepStrictEqual(res.error?._tag, "InvitationNotFoundError");
    });
  },
);

describe.sequential(
  "DELETE /orgs/{orgId}/invitations/{invitationId} (integration, non-admin member caller)",
  () => {
    const runtime = useServerTestRuntime(TABLES, {
      caller: MEMBER_CALLER,
      seedSuperAdminCaller: true,
    });

    it("forbids a member who is not an org admin from revoking", async () => {
      const { client, database } = runtime.server();
      await seedOrg(database);
      // A non-admin cannot create an invitation to then revoke, and the 403 fires before any lookup.
      await database.exec(sql.unsafe`
      INSERT INTO "organization".invitations (id, organization_id, invitee_email, token, expires_at, created_at)
      VALUES (${UNKNOWN_INVITATION_ID}, ${ORG_ID}, 'alice@example.com', 'seed-token-revoke-forbidden', now() + interval '7 days', now())
    `);
      const res = await client.DELETE(
        "/orgs/{orgId}/invitations/{invitationId}",
        revoke(UNKNOWN_INVITATION_ID),
      );
      deepStrictEqual(res.response.status, 403);
      deepStrictEqual(res.error?._tag, "Forbidden");
    });
  },
);
