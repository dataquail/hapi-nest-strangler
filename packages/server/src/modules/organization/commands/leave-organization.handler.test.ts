import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { MembershipRootOps } from "../domain/membership/membership.root-ops.js";
import { MembershipRepositoryFake } from "../infrastructure/repositories/membership.repository-fake.js";
import { LeaveOrganizationCommand } from "./leave-organization.command.js";
import { LeaveOrganizationHandler } from "./leave-organization.handler.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.parse("33333333-3333-3333-3333-333333333333");

describe("LeaveOrganizationHandler", () => {
  it("removes the membership and emits MembershipRevoked; a second leave is MembershipNotFound", async () => {
    const memberships = new MembershipRepositoryFake();
    await memberships.insertOne(
      MembershipRootOps.create({ userId, organizationId, now: new Date() }).membership,
    );
    const events = makeRecordingEventBus();
    const handler = new LeaveOrganizationHandler(
      memberships,
      events,
      makePassThroughUnitOfWork(events).unitOfWork,
    );
    const command = new LeaveOrganizationCommand({ userId, organizationId });
    deepStrictEqual((await handler.execute(command)).isOk(), true);
    deepStrictEqual((await handler.execute(command)).unwrapErr()._tag, "MembershipNotFound");
    deepStrictEqual(events.dispatched(), [{ _tag: "MembershipRevoked", userId, organizationId }]);
  });
});
