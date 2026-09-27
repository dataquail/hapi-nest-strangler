import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { InvitationRootOps } from "../invitation/invitation.root-ops.js";
import { InvitationAcceptance } from "./invitation-acceptance.domain-service.js";

const id = InvitationId.parse("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const userId = UserId.parse("33333333-3333-3333-3333-333333333333");
const now = new Date("2025-01-01T00:00:00Z");
const expiresAt = new Date("2025-01-08T00:00:00Z");

describe("InvitationAcceptance.accept", () => {
  it("closes the invitation, opens a membership and emits both events in order", () => {
    const { invitation } = InvitationRootOps.issue({
      id,
      organizationId,
      inviteeEmail: "a@x.io",
      token: "t",
      expiresAt,
      now,
    });
    const outcome = InvitationAcceptance.accept(invitation, { userId, now }).unwrap();
    deepStrictEqual(outcome.invitation.acceptedAt, now);
    deepStrictEqual(outcome.membership, { userId, organizationId, createdAt: now });
    deepStrictEqual(
      outcome.events.map((e) => e._tag),
      ["InvitationAccepted", "MembershipCreated"],
    );
  });

  it("propagates the invitation's refusal without creating a membership", () => {
    const { invitation } = InvitationRootOps.issue({
      id,
      organizationId,
      inviteeEmail: "a@x.io",
      token: "t",
      expiresAt,
      now,
    });
    const result = InvitationAcceptance.accept(invitation, { userId, now: expiresAt });
    deepStrictEqual(result.unwrapErr()._tag, "InvitationExpired");
  });
});
