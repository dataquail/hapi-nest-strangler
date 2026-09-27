import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { InvitationRootOps } from "./invitation.root-ops.js";
import { InvitationSpecifications } from "./invitation.specification.js";

const id = InvitationId.parse("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const userId = UserId.parse("33333333-3333-3333-3333-333333333333");
const now = new Date("2025-01-01T00:00:00Z");
const expiresAt = new Date("2025-01-08T00:00:00Z");
const { invitation } = InvitationRootOps.issue({
  id,
  organizationId,
  inviteeEmail: "a@x.io",
  token: "t",
  expiresAt,
  now,
});

describe("InvitationSpecifications", () => {
  it("isOpen holds for a fresh invitation and fails once accepted or revoked", () => {
    deepStrictEqual(InvitationSpecifications.isOpen(invitation), true);
    const accepted = InvitationRootOps.accept(invitation, { userId, now }).unwrap().invitation;
    deepStrictEqual(InvitationSpecifications.isOpen(accepted), false);
    const revoked = InvitationRootOps.revoke(invitation, { now }).unwrap().invitation;
    deepStrictEqual(InvitationSpecifications.isOpen(revoked), false);
  });

  it("statusAt reports expiry at the boundary", () => {
    deepStrictEqual(InvitationSpecifications.statusAt(invitation, now), "pending");
    deepStrictEqual(InvitationSpecifications.statusAt(invitation, expiresAt), "expired");
  });

  it("carries criteria for the repository", () => {
    deepStrictEqual(InvitationSpecifications.withToken("t").criteria, {
      _tag: "Eq",
      field: "token",
      value: "t",
    });
    deepStrictEqual(InvitationSpecifications.isOpen.criteria._tag, "Not");
  });
});
