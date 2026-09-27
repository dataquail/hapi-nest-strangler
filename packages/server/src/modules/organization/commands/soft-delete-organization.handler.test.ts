import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { OrganizationRootOps } from "../domain/organization/organization.root-ops.js";
import { OrganizationRepositoryFake } from "../infrastructure/repositories/organization.repository-fake.js";
import { SoftDeleteOrganizationCommand } from "./soft-delete-organization.command.js";
import { SoftDeleteOrganizationHandler } from "./soft-delete-organization.handler.js";

const organizationId = OrganizationId.parse("33333333-3333-3333-3333-333333333333");

describe("SoftDeleteOrganizationHandler", () => {
  it("soft-deletes once; a deleted organization reads as not found afterwards", async () => {
    const organizations = new OrganizationRepositoryFake();
    await organizations.insertOne(
      OrganizationRootOps.create({ id: organizationId, name: "Acme", now: new Date() })
        .organization,
    );
    const events = makeRecordingEventBus();
    const handler = new SoftDeleteOrganizationHandler(
      organizations,
      events,
      makePassThroughUnitOfWork(events).unitOfWork,
    );
    const command = new SoftDeleteOrganizationCommand({ organizationId });
    deepStrictEqual((await handler.execute(command)).isOk(), true);
    deepStrictEqual((await handler.execute(command)).unwrapErr()._tag, "OrganizationNotFound");
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["OrganizationSoftDeleted"],
    );
  });
});
