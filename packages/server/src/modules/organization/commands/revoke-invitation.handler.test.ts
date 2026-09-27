import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { InvitationRootOps } from "../domain/invitation/invitation.root-ops.js";
import { InvitationRepositoryFake } from "../infrastructure/repositories/invitation.repository-fake.js";
import { RevokeInvitationCommand } from "./revoke-invitation.command.js";
import { RevokeInvitationHandler } from "./revoke-invitation.handler.js";

const actor = UserId.parse("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const invitationId = InvitationId.parse("33333333-3333-3333-3333-333333333333");

describe("RevokeInvitationHandler", () => {
  it("revokes once and refuses a second time", async () => {
    const invitations = new InvitationRepositoryFake();
    const events = makeRecordingEventBus();
    const { unitOfWork } = makePassThroughUnitOfWork(events);
    await invitations.insertOne(
      InvitationRootOps.issue({
        id: invitationId,
        organizationId,
        inviteeEmail: "a@x.io",
        token: "t",
        expiresAt: new Date(),
        now: new Date(),
      }).invitation,
    );
    const handler = new RevokeInvitationHandler(invitations, events, unitOfWork);
    deepStrictEqual(
      (
        await handler.execute(new RevokeInvitationCommand({ invitationId, actorUserId: actor }))
      ).isOk(),
      true,
    );
    deepStrictEqual(
      (
        await handler.execute(new RevokeInvitationCommand({ invitationId, actorUserId: actor }))
      ).unwrapErr()._tag,
      "InvitationAlreadyRevoked",
    );
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["InvitationRevoked"],
    );
  });
});
