import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationRolesRepositoryFake } from "../infrastructure/repositories/organization-roles.repository-fake.js";
import { GrantOrganizationRoleCommand } from "./grant-organization-role.command.js";
import { GrantOrganizationRoleHandler } from "./grant-organization-role.handler.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const actor = UserId.parse("22222222-2222-2222-2222-222222222222");
const organizationId = OrganizationId.parse("33333333-3333-3333-3333-333333333333");

const setup = () => {
  const events = makeRecordingEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(events);
  return {
    events,
    handler: new GrantOrganizationRoleHandler(
      new OrganizationRolesRepositoryFake(),
      events,
      unitOfWork,
    ),
  };
};

describe("GrantOrganizationRoleHandler", () => {
  it("grants admin once, refuses twice, and refuses self-promotion", async () => {
    const { events, handler } = setup();
    const command = new GrantOrganizationRoleCommand({
      userId,
      organizationId,
      role: "admin",
      actorUserId: actor,
    });
    deepStrictEqual((await handler.execute(command)).isOk(), true);
    deepStrictEqual(
      (await handler.execute(command)).unwrapErr()._tag,
      "AlreadyHasOrganizationRole",
    );
    deepStrictEqual(
      (
        await handler.execute(
          new GrantOrganizationRoleCommand({
            userId: actor,
            organizationId,
            role: "admin",
            actorUserId: actor,
          }),
        )
      ).unwrapErr()._tag,
      "CannotPromoteSelfInOrganization",
    );
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["OrganizationRoleGranted"],
    );
  });
});
