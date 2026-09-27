import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { Spec } from "@/platform/ddd/contracts/specification.js";
import { UserId } from "@/platform/ids/user-id.js";

import { MembershipSpecifications } from "../domain/membership/membership.specification.js";
import { OrganizationSpecifications } from "../domain/organization/organization.specification.js";
import { OrganizationRolesSpecifications } from "../domain/organization-roles/organization-roles.specification.js";
import { PlatformRolesFake } from "../infrastructure/acl/platform-roles.acl-fake.js";
import { MembershipRepositoryFake } from "../infrastructure/repositories/membership.repository-fake.js";
import { OrganizationRepositoryFake } from "../infrastructure/repositories/organization.repository-fake.js";
import { OrganizationRolesRepositoryFake } from "../infrastructure/repositories/organization-roles.repository-fake.js";
import { CreateOrganizationCommand } from "./create-organization.command.js";
import { CreateOrganizationHandler } from "./create-organization.handler.js";

const actor = UserId.parse("11111111-1111-1111-1111-111111111111");
const superAdmin = UserId.parse("22222222-2222-2222-2222-222222222222");

const setup = () => {
  const organizations = new OrganizationRepositoryFake();
  const memberships = new MembershipRepositoryFake();
  const organizationRoles = new OrganizationRolesRepositoryFake();
  const events = makeRecordingEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(events);
  const handler = new CreateOrganizationHandler(
    organizations,
    memberships,
    organizationRoles,
    new PlatformRolesFake(new Set([superAdmin])),
    events,
    unitOfWork,
  );
  return { organizations, memberships, organizationRoles, events, handler };
};

describe("CreateOrganizationHandler", () => {
  it("creates the org, makes the actor a member and an admin, and emits all three events", async () => {
    const { events, handler, memberships, organizationRoles, organizations } = setup();
    const id = (
      await handler.execute(new CreateOrganizationCommand({ name: "Acme", actorUserId: actor }))
    ).unwrap();
    deepStrictEqual(
      (await organizations.findOne(OrganizationSpecifications.withId(id))).unwrap()?.name,
      "Acme",
    );
    deepStrictEqual(
      (
        await memberships.findOne(
          Spec.and(
            MembershipSpecifications.forUser(actor),
            MembershipSpecifications.forOrganization(id),
          ),
        )
      ).unwrap()?.userId,
      actor,
    );
    const roles = (
      await organizationRoles.findOne(
        Spec.and(
          OrganizationRolesSpecifications.forUser(actor),
          OrganizationRolesSpecifications.forOrganization(id),
        ),
      )
    ).unwrap();
    deepStrictEqual(roles?.roles, [{ role: "admin", issuedBy: actor }]);
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["OrganizationCreated", "MembershipCreated", "OrganizationRoleGranted"],
    );
  });

  it("refuses a super admin", async () => {
    const { events, handler } = setup();
    const result = await handler.execute(
      new CreateOrganizationCommand({ name: "Acme", actorUserId: superAdmin }),
    );
    deepStrictEqual(result.unwrapErr()._tag, "SuperAdminCannotOwnOrganization");
    deepStrictEqual(events.dispatched(), []);
  });
});
