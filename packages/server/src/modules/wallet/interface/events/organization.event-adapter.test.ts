import { deepStrictEqual, rejects } from "node:assert";

import { makeEventBus } from "@org/event-bus";
import { PersistenceUnavailable } from "@org/unit-of-work";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { Err, Ok } from "oxide.ts";
import { describe, it } from "vitest";

import { CreateWalletCommand } from "@/modules/wallet/commands/create-wallet.command.js";
import { organizationAccessDomainEvents } from "@/modules/wallet/wallet.imports.js";
import type { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { OrganizationEventAdapter } from "./organization.event-adapter.js";

const organizationId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");

const recordingCommandBus = (answer: unknown) => {
  const executed: Array<unknown> = [];
  const bus = {
    execute: (command: unknown) => {
      executed.push(command);
      return Promise.resolve(answer);
    },
  } as unknown as AppCommandBus;
  return { bus, executed };
};

describe("OrganizationEventAdapter", () => {
  it("translates OrganizationCreated into a CreateWalletCommand dispatched inside the publisher's unit of work", async () => {
    const { bus: commandBus, executed } = recordingCommandBus(Ok(undefined));
    const events = makeEventBus();
    const { unitOfWork } = makePassThroughUnitOfWork(events);
    new OrganizationEventAdapter(events, commandBus).onModuleInit();

    await unitOfWork.run(async () => {
      await events.dispatch([
        organizationAccessDomainEvents.OrganizationCreated.make({ organizationId, name: "Acme" }),
      ]);
      deepStrictEqual(executed, [new CreateWalletCommand({ organizationId })]);
    });
  });

  it("propagates a failed command out of dispatch so the publisher rolls back", async () => {
    const { bus: commandBus } = recordingCommandBus(
      Err(new PersistenceUnavailable({ message: "down" })),
    );
    const events = makeEventBus();
    const { unitOfWork } = makePassThroughUnitOfWork(events);
    new OrganizationEventAdapter(events, commandBus).onModuleInit();

    await rejects(
      unitOfWork.run(() =>
        events.dispatch([
          organizationAccessDomainEvents.OrganizationCreated.make({ organizationId, name: "Acme" }),
        ]),
      ),
      /CreateWalletCommand failed: PersistenceUnavailable/,
    );
  });
});
