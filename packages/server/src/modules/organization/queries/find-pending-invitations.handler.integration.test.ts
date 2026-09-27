import { deepStrictEqual } from "node:assert";

import type { Database } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, runTestMigrations, truncate } from "@/test-utils/test-database.js";

import { InvitationRootOps } from "../domain/invitation/invitation.root-ops.js";
import { OrganizationRootOps } from "../domain/organization/organization.root-ops.js";
import { InvitationRepositoryLive } from "../infrastructure/repositories/invitation.repository-live.js";
import { OrganizationRepositoryLive } from "../infrastructure/repositories/organization.repository-live.js";
import { FindPendingInvitationsHandler } from "./find-pending-invitations.handler.js";
import { FindPendingInvitationsQuery } from "./find-pending-invitations.query.js";

const orgId = OrganizationId.parse("55555555-5555-5555-5555-555555555555");
const otherOrgId = OrganizationId.parse("99999999-9999-9999-9999-999999999999");
const userId = UserId.parse("66666666-6666-6666-6666-666666666666");
const issuedAt = new Date("2026-01-01T00:00:00Z");
// The handler reads the wall clock; expiries sit far on either side of any plausible "now".
const farFuture = new Date("2099-01-01T00:00:00Z");
const farPast = new Date("2020-01-01T00:00:00Z");

const issue = (id: string, email: string, expiresAt: Date, organizationId = orgId) =>
  InvitationRootOps.issue({
    id: InvitationId.parse(id),
    organizationId,
    inviteeEmail: email,
    token: `tok-${id}`,
    expiresAt,
    now: issuedAt,
  }).invitation;

describe.sequential("FindPendingInvitationsHandler (integration)", () => {
  let db: Database;
  let invitations: InvitationRepositoryLive;
  let handler: FindPendingInvitationsHandler;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
    invitations = new InvitationRepositoryLive(db);
    handler = new FindPendingInvitationsHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "organization.invitations", "organization.organizations");
    const orgs = new OrganizationRepositoryLive(db);
    (
      await orgs.insertOne(
        OrganizationRootOps.create({ id: orgId, name: "Acme", now: issuedAt }).organization,
      )
    ).unwrap();
    (
      await orgs.insertOne(
        OrganizationRootOps.create({ id: otherOrgId, name: "Other", now: issuedAt }).organization,
      )
    ).unwrap();
  });

  it("returns only open invitations, tagged pending vs expired", async () => {
    const pending = issue("11111111-1111-1111-1111-111111111111", "live@example.com", farFuture);
    const expired = issue("22222222-2222-2222-2222-222222222222", "lapsed@example.com", farPast);
    const toRevoke = issue("33333333-3333-3333-3333-333333333333", "gone@example.com", farFuture);
    const toAccept = issue("44444444-4444-4444-4444-444444444444", "in@example.com", farFuture);
    const otherOrg = issue(
      "55555555-5555-5555-5555-555555555556",
      "other@example.com",
      farFuture,
      otherOrgId,
    );
    for (const invitation of [pending, expired, toRevoke, toAccept, otherOrg]) {
      (await invitations.insertOne(invitation)).unwrap();
    }
    (
      await invitations.updateOne(
        InvitationRootOps.revoke(toRevoke, { now: issuedAt }).unwrap().invitation,
      )
    ).unwrap();
    (
      await invitations.updateOne(
        InvitationRootOps.accept(toAccept, { userId, now: issuedAt }).unwrap().invitation,
      )
    ).unwrap();

    const result = (
      await handler.execute(new FindPendingInvitationsQuery({ organizationId: orgId }))
    ).unwrap();
    const byEmail = new Map(result.map((r) => [r.inviteeEmail, r]));
    deepStrictEqual(result.length, 2);
    deepStrictEqual(byEmail.get("live@example.com")?.status, "pending");
    deepStrictEqual(byEmail.get("lapsed@example.com")?.status, "expired");
    deepStrictEqual(byEmail.has("gone@example.com"), false);
    deepStrictEqual(byEmail.has("in@example.com"), false);
    deepStrictEqual(byEmail.has("other@example.com"), false);
  });

  it("returns an empty list for an org with no open invitations", async () => {
    const result = (
      await handler.execute(new FindPendingInvitationsQuery({ organizationId: orgId }))
    ).unwrap();
    deepStrictEqual(result.length, 0);
  });
});
