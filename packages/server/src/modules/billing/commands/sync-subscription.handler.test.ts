import { deepStrictEqual } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { SubscriptionId } from "../domain/subscription/subscription.id.js";
import { SubscriptionRootOps } from "../domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "../domain/subscription/subscription.specification.js";
import { SubscriptionRepositoryFake } from "../infrastructure/repositories/subscription.repository-fake.js";
import { SyncSubscriptionCommand } from "./sync-subscription.command.js";
import { SyncSubscriptionHandler } from "./sync-subscription.handler.js";

const acme = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const subId = SubscriptionId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const stripeSubId = "sub_test";

const setup = async (seeded: boolean) => {
  const subscriptions = new SubscriptionRepositoryFake();
  if (seeded) {
    const { subscription } = SubscriptionRootOps.create({
      id: subId,
      organizationId: acme,
      stripeCustomerId: "cus_seed",
      stripeSubscriptionId: stripeSubId,
      status: "trialing",
      currentPeriodEnd: null,
      now: new Date("2025-01-01T00:00:00Z"),
    });
    (await subscriptions.insertOne(subscription)).unwrap();
  }
  const events = makeRecordingEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(events);
  return {
    subscriptions,
    events,
    handler: new SyncSubscriptionHandler(subscriptions, events, unitOfWork),
  };
};

describe("SyncSubscriptionHandler", () => {
  it("applies the reported status and dispatches SubscriptionStatusChanged", async () => {
    const { events, handler, subscriptions } = await setup(true);
    (
      await handler.execute(
        new SyncSubscriptionCommand({
          stripeSubscriptionId: stripeSubId,
          status: "active",
          currentPeriodEnd: null,
        }),
      )
    ).unwrap();
    deepStrictEqual(
      (await subscriptions.findOne(SubscriptionSpecifications.forOrganization(acme))).unwrap()
        ?.status,
      "active",
    );
    deepStrictEqual(
      events.dispatched().map((e) => e._tag),
      ["SubscriptionStatusChanged"],
    );
  });

  it("is a no-op for an unknown stripe subscription id (out-of-order delivery)", async () => {
    const { events, handler, subscriptions } = await setup(false);
    (
      await handler.execute(
        new SyncSubscriptionCommand({
          stripeSubscriptionId: "sub_never_seen",
          status: "active",
          currentPeriodEnd: null,
        }),
      )
    ).unwrap();
    deepStrictEqual(
      (await subscriptions.findOne(SubscriptionSpecifications.forOrganization(acme))).unwrap(),
      null,
    );
    deepStrictEqual(events.dispatched(), []);
  });
});
