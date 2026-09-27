import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { InvitationRootOps } from "../domain/invitation/invitation.root-ops.js";
import { PlatformRolesFake } from "../infrastructure/acl/platform-roles.acl-fake.js";
import { InvitationRepositoryFake } from "../infrastructure/repositories/invitation.repository-fake.js";
import { MembershipRepositoryFake } from "../infrastructure/repositories/membership.repository-fake.js";
import { AcceptInvitationCommand } from "./accept-invitation.command.js";
import { AcceptInvitationHandler } from "./accept-invitation.handler.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const superAdmin = UserId.parse("22222222-2222-2222-2222-222222222222");
const organizationId = OrganizationId.parse("33333333-3333-3333-3333-333333333333");
const invitationId = InvitationId.parse("44444444-4444-4444-4444-444444444444");
const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 1000);

const setup = async (expiresAt: Date = future) => {
  const invitations = new InvitationRepositoryFake();
  const memberships = new MembershipRepositoryFake();
  const events = makeRecordingEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(events);
  await invitations.insertOne(
    InvitationRootOps.issue({
      id: invitationId,
      organizationId,
      inviteeEmail: "a@x.io",
      token: "tok",
      expiresAt,
      now: new Date(),
    }).invitation,
  );
  const handler = new AcceptInvitationHandler(
    invitations,
    memberships,
    new PlatformRolesFake(new Set([superAdmin])),
    events,
    unitOfWork,
  );
  return { invitations, memberships, events, handler };
};

describe("AcceptInvitationHandler", () => {
  it("accepts by token, creates the membership and emits InvitationAccepted + MembershipCreated", async () => {
    const { events, handler } = await setup();
    const result = await handler.execute(new AcceptInvitationCommand({ token: "tok", userId }));
    deepStrictEqual(result.unwrap(), organizationId);
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["InvitationAccepted", "MembershipCreated"],
    );
  });

  it("reports InvitationTokenNotFound for an unknown token", async () => {
    const { handler } = await setup();
    deepStrictEqual(
      (await handler.execute(new AcceptInvitationCommand({ token: "nope", userId }))).unwrapErr()
        ._tag,
      "InvitationTokenNotFound",
    );
  });

  it("reports InvitationExpired past the expiry", async () => {
    const { handler } = await setup(past);
    deepStrictEqual(
      (await handler.execute(new AcceptInvitationCommand({ token: "tok", userId }))).unwrapErr()
        ._tag,
      "InvitationExpired",
    );
  });

  it("refuses a super admin", async () => {
    const { handler } = await setup();
    deepStrictEqual(
      (
        await handler.execute(new AcceptInvitationCommand({ token: "tok", userId: superAdmin }))
      ).unwrapErr()._tag,
      "SuperAdminCannotOwnOrganization",
    );
  });
});
