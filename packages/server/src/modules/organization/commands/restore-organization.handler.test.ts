import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { OrganizationRootOps } from "../domain/organization/organization.root-ops.js";
import { OrganizationRepositoryFake } from "../infrastructure/repositories/organization.repository-fake.js";
import { RestoreOrganizationCommand } from "./restore-organization.command.js";
import { RestoreOrganizationHandler } from "./restore-organization.handler.js";

const organizationId = OrganizationId.parse("33333333-3333-3333-3333-333333333333");

describe("RestoreOrganizationHandler", () => {
  it("restores a soft-deleted organization, refuses a live one and reports an unknown id", async () => {
    const organizations = new OrganizationRepositoryFake();
    const { organization } = OrganizationRootOps.create({
      id: organizationId,
      name: "Acme",
      now: new Date(),
    });
    await organizations.insertOne(
      OrganizationRootOps.softDelete(organization, { now: new Date() }).unwrap().organization,
    );
    const events = makeRecordingEventBus();
    const handler = new RestoreOrganizationHandler(
      organizations,
      events,
      makePassThroughUnitOfWork(events).unitOfWork,
    );
    const command = new RestoreOrganizationCommand({ organizationId });
    deepStrictEqual((await handler.execute(command)).isOk(), true);
    deepStrictEqual((await handler.execute(command)).unwrapErr()._tag, "OrganizationNotDeleted");
    deepStrictEqual(
      (
        await handler.execute(
          new RestoreOrganizationCommand({
            organizationId: OrganizationId.parse("44444444-4444-4444-4444-444444444444"),
          }),
        )
      ).unwrapErr()._tag,
      "OrganizationNotFound",
    );
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["OrganizationRestored"],
    );
  });
});
