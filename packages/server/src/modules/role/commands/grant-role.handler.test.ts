import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { RolesSpecifications } from "../domain/roles/roles.specification.js";
import { RolesRepositoryFake } from "../infrastructure/repositories/roles.repository-fake.js";
import { GrantRoleCommand } from "./grant-role.command.js";
import { GrantRoleHandler } from "./grant-role.handler.js";

const alice = UserId.parse("11111111-1111-1111-1111-111111111111");
const actor = UserId.parse("22222222-2222-2222-2222-222222222222");

const setup = () => {
  const roles = new RolesRepositoryFake();
  const events = makeRecordingEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(events);
  return { roles, events, handler: new GrantRoleHandler(roles, events, unitOfWork) };
};

describe("GrantRoleHandler", () => {
  it("grants the role to a user with none and emits RoleGranted", async () => {
    const { events, handler, roles } = setup();
    const result = await handler.execute(
      new GrantRoleCommand({ userId: alice, role: "super_admin", actorUserId: actor }),
    );
    deepStrictEqual(result.isOk(), true);
    const stored = (await roles.findOne(RolesSpecifications.forUser(alice))).unwrap();
    deepStrictEqual(stored?.roles, ["super_admin"]);
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["RoleGranted"],
    );
  });

  it("refuses to promote oneself", async () => {
    const { events, handler } = setup();
    const result = await handler.execute(
      new GrantRoleCommand({ userId: alice, role: "super_admin", actorUserId: alice }),
    );
    deepStrictEqual(result.unwrapErr()._tag, "CannotPromoteSelf");
    deepStrictEqual(events.dispatched(), []);
  });

  it("refuses a role already held", async () => {
    const { handler } = setup();
    await handler.execute(
      new GrantRoleCommand({ userId: alice, role: "super_admin", actorUserId: actor }),
    );
    const second = await handler.execute(
      new GrantRoleCommand({ userId: alice, role: "super_admin", actorUserId: actor }),
    );
    deepStrictEqual(second.unwrapErr()._tag, "AlreadyHasRole");
  });
});
