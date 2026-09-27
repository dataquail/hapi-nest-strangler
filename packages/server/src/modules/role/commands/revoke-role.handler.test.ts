import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { RolesRootOps } from "../domain/roles/roles.root-ops.js";
import { RolesSpecifications } from "../domain/roles/roles.specification.js";
import { RolesRepositoryFake } from "../infrastructure/repositories/roles.repository-fake.js";
import { RevokeRoleCommand } from "./revoke-role.command.js";
import { RevokeRoleHandler } from "./revoke-role.handler.js";

const alice = UserId.parse("11111111-1111-1111-1111-111111111111");

const setup = () => {
  const roles = new RolesRepositoryFake();
  const events = makeRecordingEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(events);
  return { roles, events, handler: new RevokeRoleHandler(roles, events, unitOfWork) };
};

describe("RevokeRoleHandler", () => {
  it("revokes a held role and emits RoleRevoked", async () => {
    const { events, handler, roles } = setup();
    await roles.upsertOne(
      RolesRootOps.grant(RolesRootOps.empty(alice), "super_admin").unwrap().roles,
    );
    const result = await handler.execute(
      new RevokeRoleCommand({ userId: alice, role: "super_admin" }),
    );
    deepStrictEqual(result.isOk(), true);
    deepStrictEqual((await roles.findOne(RolesSpecifications.forUser(alice))).unwrap()?.roles, []);
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["RoleRevoked"],
    );
  });

  it("refuses to revoke a role not held", async () => {
    const { handler } = setup();
    const result = await handler.execute(
      new RevokeRoleCommand({ userId: alice, role: "super_admin" }),
    );
    deepStrictEqual(result.unwrapErr()._tag, "DoesNotHaveRole");
  });
});
