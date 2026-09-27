import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { MembershipRootOps } from "../domain/membership/membership.root-ops.js";
import { MembershipRepositoryFake } from "../infrastructure/repositories/membership.repository-fake.js";
import { RemoveMemberCommand } from "./remove-member.command.js";
import { RemoveMemberHandler } from "./remove-member.handler.js";

const target = UserId.parse("11111111-1111-1111-1111-111111111111");
const actor = UserId.parse("22222222-2222-2222-2222-222222222222");
const organizationId = OrganizationId.parse("33333333-3333-3333-3333-333333333333");

describe("RemoveMemberHandler", () => {
  it("removes the target's membership and reports MembershipNotFound afterwards", async () => {
    const memberships = new MembershipRepositoryFake();
    await memberships.insertOne(
      MembershipRootOps.create({ userId: target, organizationId, now: new Date() }).membership,
    );
    const events = makeRecordingEventBus();
    const handler = new RemoveMemberHandler(
      memberships,
      events,
      makePassThroughUnitOfWork(events).unitOfWork,
    );
    const command = new RemoveMemberCommand({
      targetUserId: target,
      organizationId,
      actorUserId: actor,
    });
    deepStrictEqual((await handler.execute(command)).isOk(), true);
    deepStrictEqual((await handler.execute(command)).unwrapErr()._tag, "MembershipNotFound");
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["MembershipRevoked"],
    );
  });
});
