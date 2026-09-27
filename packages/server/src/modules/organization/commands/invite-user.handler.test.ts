import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { InvitationSpecifications } from "../domain/invitation/invitation.specification.js";
import { InvitationRepositoryFake } from "../infrastructure/repositories/invitation.repository-fake.js";
import { InviteUserCommand } from "./invite-user.command.js";
import { InviteUserHandler } from "./invite-user.handler.js";

const actor = UserId.parse("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");

const setup = () => {
  const invitations = new InvitationRepositoryFake();
  const events = makeRecordingEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(events);
  return { invitations, events, handler: new InviteUserHandler(invitations, events, unitOfWork) };
};

describe("InviteUserHandler", () => {
  it("issues a new invitation with a token and expiry, emitting InvitationIssued", async () => {
    const { events, handler, invitations } = setup();
    const id = (
      await handler.execute(
        new InviteUserCommand({
          organizationId,
          inviteeEmail: "a@x.io",
          ttlSeconds: 60,
          actorUserId: actor,
        }),
      )
    ).unwrap();
    const stored = (await invitations.findOne(InvitationSpecifications.withId(id))).unwrap();
    deepStrictEqual(stored?.inviteeEmail, "a@x.io");
    deepStrictEqual(stored !== null && stored.token.length > 20, true);
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["InvitationIssued"],
    );
  });

  it("reissues an open invitation for the same address instead of creating a second", async () => {
    const { events, handler } = setup();
    const first = (
      await handler.execute(
        new InviteUserCommand({
          organizationId,
          inviteeEmail: "a@x.io",
          ttlSeconds: 60,
          actorUserId: actor,
        }),
      )
    ).unwrap();
    const second = (
      await handler.execute(
        new InviteUserCommand({
          organizationId,
          inviteeEmail: "a@x.io",
          ttlSeconds: 60,
          actorUserId: actor,
        }),
      )
    ).unwrap();
    deepStrictEqual(first, second);
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["InvitationIssued", "InvitationReissued"],
    );
  });
});
