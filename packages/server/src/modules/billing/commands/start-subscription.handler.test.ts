import { deepStrictEqual, ok } from "node:assert";

import { makeRecordingEventBus } from "@org/event-bus/testing";
import { makePassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { SubscriptionStarted } from "../domain/subscription/subscription.events.js";
import { SubscriptionSpecifications } from "../domain/subscription/subscription.specification.js";
import { BillingGatewayFake } from "../infrastructure/clients/billing-gateway.client-fake.js";
import { SubscriptionRepositoryFake } from "../infrastructure/repositories/subscription.repository-fake.js";
import { StartSubscriptionCommand } from "./start-subscription.command.js";
import { StartSubscriptionHandler } from "./start-subscription.handler.js";

const acme = OrganizationId.parse("11111111-1111-1111-1111-111111111111");

const setup = () => {
  const subscriptions = new SubscriptionRepositoryFake();
  const events = makeRecordingEventBus();
  const { unitOfWork } = makePassThroughUnitOfWork(events);
  const handler = new StartSubscriptionHandler(
    subscriptions,
    new BillingGatewayFake(),
    events,
    unitOfWork,
  );
  return { subscriptions, events, handler };
};

describe("StartSubscriptionHandler", () => {
  it("creates a provider customer + subscription, persists it, publishes SubscriptionStarted", async () => {
    const { events, handler, subscriptions } = setup();
    const sub = (
      await handler.execute(new StartSubscriptionCommand({ organizationId: acme }))
    ).unwrap();
    deepStrictEqual(sub.organizationId, acme);
    ok(sub.stripeCustomerId.startsWith("cus_test_"));
    ok(sub.stripeSubscriptionId.startsWith("sub_test_"));
    deepStrictEqual(sub.status, "active");
    ok(
      (await subscriptions.findOne(SubscriptionSpecifications.forOrganization(acme))).unwrap() !==
        null,
    );
    const started = events.byTag(SubscriptionStarted);
    deepStrictEqual(started.length, 1);
    deepStrictEqual(started[0]?.organizationId, acme);
  });

  it("fails SubscriptionAlreadyExistsForOrganization on a second start for the same org", async () => {
    const { handler } = setup();
    (await handler.execute(new StartSubscriptionCommand({ organizationId: acme }))).unwrap();
    const second = await handler.execute(new StartSubscriptionCommand({ organizationId: acme }));
    deepStrictEqual(second.unwrapErr()._tag, "SubscriptionAlreadyExistsForOrganization");
  });
});
