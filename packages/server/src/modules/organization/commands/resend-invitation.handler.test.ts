import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { InvitationRootOps } from "../domain/invitation/invitation.root-ops.js";
import { InvitationSpecifications } from "../domain/invitation/invitation.specification.js";
import { InvitationRepositoryFake } from "../infrastructure/repositories/invitation.repository-fake.js";
import { ResendInvitationCommand } from "./resend-invitation.command.js";
import { ResendInvitationHandler } from "./resend-invitation.handler.js";

const actor = UserId.parse("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const invitationId = InvitationId.parse("33333333-3333-3333-3333-333333333333");

describe("ResendInvitationHandler", () => {
  it("rotates the token and emits InvitationReissued", async () => {
    const invitations = new InvitationRepositoryFake();
    const events = makeRecordingEventBus();
    const { unitOfWork } = makePassThroughUnitOfWork(events);
    await invitations.insertOne(
      InvitationRootOps.issue({
        id: invitationId,
        organizationId,
        inviteeEmail: "a@x.io",
        token: "old",
        expiresAt: new Date(),
        now: new Date(),
      }).invitation,
    );
    const handler = new ResendInvitationHandler(invitations, events, unitOfWork);
    deepStrictEqual(
      (
        await handler.execute(
          new ResendInvitationCommand({ invitationId, ttlSeconds: 60, actorUserId: actor }),
        )
      ).isOk(),
      true,
    );
    deepStrictEqual(
      (await invitations.findOne(InvitationSpecifications.withId(invitationId))).unwrap()?.token !==
        "old",
      true,
    );
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["InvitationReissued"],
    );
  });

  it("reports InvitationNotFound for an unknown id", async () => {
    const events = makeRecordingEventBus();
    const handler = new ResendInvitationHandler(
      new InvitationRepositoryFake(),
      events,
      makePassThroughUnitOfWork(events).unitOfWork,
    );
    deepStrictEqual(
      (
        await handler.execute(
          new ResendInvitationCommand({ invitationId, ttlSeconds: 60, actorUserId: actor }),
        )
      ).unwrapErr()._tag,
      "InvitationNotFound",
    );
  });
});
