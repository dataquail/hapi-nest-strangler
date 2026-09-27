import { deepStrictEqual } from "node:assert";

import { makeEventBus } from "@org/event-bus";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { Ok } from "oxide.ts";
import { describe, it } from "vitest";

import {
  InvitationIssued,
  InvitationReissued,
} from "@/modules/organization/domain/invitation/invitation.events.js";
import type { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { InvitationEventAdapter } from "./invitation.event-adapter.js";

const invitationId = InvitationId.parse("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");

describe("InvitationEventAdapter", () => {
  it("dispatches SendInvitationEmailCommand after the issuing unit of work commits, for issued and reissued", async () => {
    const executed: Array<string> = [];
    const commandBus = {
      execute: (command: { constructor: { name: string } }) => {
        executed.push(command.constructor.name);
        return Promise.resolve(Ok(undefined));
      },
    } as unknown as AppCommandBus;
    const bus = makeEventBus();
    const { unitOfWork } = makePassThroughUnitOfWork(bus);
    new InvitationEventAdapter(bus, commandBus).onModuleInit();

    await unitOfWork.run(async () => {
      await bus.dispatch([
        InvitationIssued.make({ invitationId, organizationId, inviteeEmail: "a@x.io" }),
      ]);
      deepStrictEqual(executed, []);
    });
    deepStrictEqual(executed, ["SendInvitationEmailCommand"]);

    await unitOfWork.run(() =>
      bus.dispatch([
        InvitationReissued.make({ invitationId, organizationId, inviteeEmail: "a@x.io" }),
      ]),
    );
    deepStrictEqual(executed, ["SendInvitationEmailCommand", "SendInvitationEmailCommand"]);
  });
});
