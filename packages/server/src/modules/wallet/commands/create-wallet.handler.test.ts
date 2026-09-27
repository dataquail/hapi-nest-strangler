import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletSpecifications } from "../domain/wallet/wallet.specification.js";
import { WalletRepositoryFake } from "../infrastructure/repositories/wallet.repository-fake.js";
import { CreateWalletCommand } from "./create-wallet.command.js";
import { CreateWalletHandler } from "./create-wallet.handler.js";

const organizationId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");

const setup = () => {
  const wallets = new WalletRepositoryFake();
  const events = makeRecordingEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(events);
  return { wallets, events, handler: new CreateWalletHandler(wallets, events, unitOfWork) };
};

describe("CreateWalletHandler", () => {
  it("inserts a wallet with balance 0 and dispatches WalletCreated", async () => {
    const { events, handler, wallets } = setup();
    (await handler.execute(new CreateWalletCommand({ organizationId }))).unwrap();
    const stored = (
      await wallets.findOne(WalletSpecifications.forOrganization(organizationId))
    ).unwrap();
    deepStrictEqual(stored?.balance, 0);
    deepStrictEqual(stored?.organizationId, organizationId);
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["WalletCreated"],
    );
  });

  it("is idempotent: a duplicate command succeeds and dispatches no second event", async () => {
    const { events, handler } = setup();
    (await handler.execute(new CreateWalletCommand({ organizationId }))).unwrap();
    const again = await handler.execute(new CreateWalletCommand({ organizationId }));
    deepStrictEqual(again.isOk(), true);
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["WalletCreated"],
    );
  });
});
