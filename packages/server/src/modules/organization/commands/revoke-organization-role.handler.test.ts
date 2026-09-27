import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { OrganizationRolesRootOps } from "../domain/organization-roles/organization-roles.root-ops.js";
import { OrganizationRolesRepositoryFake } from "../infrastructure/repositories/organization-roles.repository-fake.js";
import { RevokeOrganizationRoleCommand } from "./revoke-organization-role.command.js";
import { RevokeOrganizationRoleHandler } from "./revoke-organization-role.handler.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const issuer = UserId.parse("22222222-2222-2222-2222-222222222222");
const organizationId = OrganizationId.parse("33333333-3333-3333-3333-333333333333");

describe("RevokeOrganizationRoleHandler", () => {
  it("revokes a held role and refuses one not held", async () => {
    const repo = new OrganizationRolesRepositoryFake();
    await repo.upsertOne(
      OrganizationRolesRootOps.grantRole(
        OrganizationRolesRootOps.empty(userId, organizationId),
        "admin",
        issuer,
      ).unwrap().organizationRoles,
    );
    const events = makeRecordingEventBus();
    const handler = new RevokeOrganizationRoleHandler(
      repo,
      events,
      makePassThroughUnitOfWork(events).unitOfWork,
    );
    const command = new RevokeOrganizationRoleCommand({ userId, organizationId, role: "admin" });
    deepStrictEqual((await handler.execute(command)).isOk(), true);
    deepStrictEqual(
      (await handler.execute(command)).unwrapErr()._tag,
      "DoesNotHaveOrganizationRole",
    );
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["OrganizationRoleRevoked"],
    );
  });
});
