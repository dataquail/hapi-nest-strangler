import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { InvitationRootOps } from "./invitation.root-ops.js";

const id = InvitationId.parse("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const userId = UserId.parse("33333333-3333-3333-3333-333333333333");
const now = new Date("2025-01-01T00:00:00Z");
const expiresAt = new Date("2025-01-08T00:00:00Z");
const afterExpiry = new Date("2025-01-09T00:00:00Z");

const fresh = () =>
  InvitationRootOps.issue({
    id,
    organizationId,
    inviteeEmail: "a@x.io",
    token: "tok",
    expiresAt,
    now,
  }).invitation;

describe("InvitationRootOps.issue", () => {
  it("emits InvitationIssued with an open invitation", () => {
    const { events, invitation } = InvitationRootOps.issue({
      id,
      organizationId,
      inviteeEmail: "a@x.io",
      token: "tok",
      expiresAt,
      now,
    });
    deepStrictEqual(invitation.acceptedAt, null);
    deepStrictEqual(events, [
      { _tag: "InvitationIssued", invitationId: id, organizationId, inviteeEmail: "a@x.io" },
    ]);
  });
});

describe("InvitationRootOps.accept", () => {
  it("accepts an open, unexpired invitation", () => {
    const outcome = InvitationRootOps.accept(fresh(), { userId, now }).unwrap();
    deepStrictEqual(outcome.invitation.acceptedAt, now);
    deepStrictEqual(outcome.events, [
      { _tag: "InvitationAccepted", invitationId: id, organizationId, userId },
    ]);
  });

  it("refuses an already accepted, a revoked and an expired invitation with distinct errors", () => {
    const accepted = InvitationRootOps.accept(fresh(), { userId, now }).unwrap().invitation;
    deepStrictEqual(
      InvitationRootOps.accept(accepted, { userId, now }).unwrapErr()._tag,
      "InvitationAlreadyAccepted",
    );
    const revoked = InvitationRootOps.revoke(fresh(), { now }).unwrap().invitation;
    deepStrictEqual(
      InvitationRootOps.accept(revoked, { userId, now }).unwrapErr()._tag,
      "InvitationRevoked",
    );
    deepStrictEqual(
      InvitationRootOps.accept(fresh(), { userId, now: afterExpiry }).unwrapErr()._tag,
      "InvitationExpired",
    );
  });
});

describe("InvitationRootOps.revoke and reissue", () => {
  it("revoke stamps revokedAt once", () => {
    const revoked = InvitationRootOps.revoke(fresh(), { now }).unwrap();
    deepStrictEqual(revoked.invitation.revokedAt, now);
    deepStrictEqual(
      InvitationRootOps.revoke(revoked.invitation, { now }).unwrapErr()._tag,
      "InvitationAlreadyRevoked",
    );
  });

  it("reissue rotates the token and expiry and emits InvitationReissued", () => {
    const reissued = InvitationRootOps.reissue(fresh(), {
      token: "new",
      expiresAt: afterExpiry,
      now,
    }).unwrap();
    deepStrictEqual(reissued.invitation.token, "new");
    deepStrictEqual(reissued.invitation.expiresAt, afterExpiry);
    deepStrictEqual(reissued.events[0]?._tag, "InvitationReissued");
    const accepted = InvitationRootOps.accept(fresh(), { userId, now }).unwrap().invitation;
    deepStrictEqual(
      InvitationRootOps.reissue(accepted, { token: "n", expiresAt, now }).unwrapErr()._tag,
      "InvitationAlreadyAccepted",
    );
  });
});
