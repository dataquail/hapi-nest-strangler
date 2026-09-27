import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { describe, it } from "vitest";

import { MEMBER_CALLER, MEMBER_CALLER_ID } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const TABLES = [
  "organization.invitations",
  "organization.memberships",
  "organization.organizations",
  "user.users",
];
const ORG_ID = "11111111-1111-1111-1111-111111111111";

const seedOrg = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${ORG_ID}, 'Acme', now(), now(), null)
  `);

// The invite endpoint never returns the raw token (it is e-mailed), and
// inviting needs an admin while accepting needs the invitee's own session, so
// the invitation row is seeded directly with a known token.
const iso = (offsetMs: number): string => new Date(Date.now() + offsetMs).toISOString();
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const seedInvitation = (
  db: Database,
  token: string,
  overrides: { acceptedAt?: string; revokedAt?: string; expiresAt?: string } = {},
) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".invitations
      (organization_id, invitee_email, token, expires_at, accepted_at, revoked_at, created_at)
    VALUES (${ORG_ID}, 'alice@example.com', ${token}, ${overrides.expiresAt ?? iso(SEVEN_DAYS_MS)},
            ${overrides.acceptedAt ?? null}, ${overrides.revokedAt ?? null}, now())
  `);

type GoneBody = { readonly _tag: string; readonly reason?: string };

// Accepting provisions a membership keyed to the caller; a super-admin cannot
// own an org, so the invitee session is the member caller.
describe.sequential("POST /invitations/{token}/accept (integration, member caller)", () => {
  const runtime = useServerTestRuntime(TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("accepts a pending invitation and provisions membership", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    await seedInvitation(database, "accept-token-happy-path");
    const res = await client.POST("/invitations/{token}/accept", {
      params: { path: { token: "accept-token-happy-path" } },
    });
    deepStrictEqual(res.data?.organizationId, ORG_ID);
    const count = await database.exec(sql.unsafe`
      SELECT 1 FROM "organization".memberships WHERE user_id = ${MEMBER_CALLER_ID} AND organization_id = ${ORG_ID}
    `);
    deepStrictEqual(count, 1);
  });

  it("returns 404 for an unknown token", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    const res = await client.POST("/invitations/{token}/accept", {
      params: { path: { token: "nope" } },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "InvitationNotFoundError");
  });

  it("returns 410 Gone for an already-revoked invitation", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    await seedInvitation(database, "accept-token-revoked", { revokedAt: "2020-01-01T00:00:00Z" });
    const res = await client.POST("/invitations/{token}/accept", {
      params: { path: { token: "accept-token-revoked" } },
    });
    deepStrictEqual(res.response.status, 410);
    const error = res.error as GoneBody | undefined;
    deepStrictEqual(error?._tag, "InvitationGoneError");
    deepStrictEqual(error?.reason, "revoked");
  });

  it("returns 410 Gone for an expired invitation", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    await seedInvitation(database, "accept-token-expired", { expiresAt: iso(-SEVEN_DAYS_MS) });
    const res = await client.POST("/invitations/{token}/accept", {
      params: { path: { token: "accept-token-expired" } },
    });
    deepStrictEqual(res.response.status, 410);
    const error = res.error as GoneBody | undefined;
    deepStrictEqual(error?._tag, "InvitationGoneError");
    deepStrictEqual(error?.reason, "expired");
  });
});

describe.sequential("POST /invitations/{token}/accept (integration, super-admin caller)", () => {
  const runtime = useServerTestRuntime(TABLES, { seedSuperAdminCaller: true });

  it("refuses a super-admin caller with 409", async () => {
    const { client, database } = runtime.server();
    await seedOrg(database);
    await seedInvitation(database, "accept-token-superadmin");
    const res = await client.POST("/invitations/{token}/accept", {
      params: { path: { token: "accept-token-superadmin" } },
    });
    deepStrictEqual(res.response.status, 409);
    deepStrictEqual(res.error?._tag, "SuperAdminCannotOwnOrganizationError");
  });
});
