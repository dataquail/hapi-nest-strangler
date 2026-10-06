import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { WebhookEventSpecifications } from "@/modules/billing/domain/webhook-event/webhook-event.specification.js";

import { WebhookEventRepositoryFake } from "./webhook-event.repository-fake.js";

describe("WebhookEventRepositoryFake", () => {
  it("persists the event id and makes it findable", async () => {
    const repo = new WebhookEventRepositoryFake();
    (await repo.insertOne("evt_abc")).unwrap();
    const found = (
      await repo.findOne(WebhookEventSpecifications.withStripeEventId("evt_abc"))
    ).unwrap();
    ok(found !== null);
    deepStrictEqual(found.stripeEventId, "evt_abc");
  });

  it("fails WebhookEventAlreadyRecorded on a duplicate insert", async () => {
    const repo = new WebhookEventRepositoryFake();
    (await repo.insertOne("evt_abc")).unwrap();
    deepStrictEqual(
      (await repo.insertOne("evt_abc")).unwrapErr()._tag,
      "WebhookEventAlreadyRecorded",
    );
  });

  it("treats distinct event ids independently and returns null for an unknown id", async () => {
    const repo = new WebhookEventRepositoryFake();
    (await repo.insertOne("evt_a")).unwrap();
    (await repo.insertOne("evt_b")).unwrap();
    ok(
      (await repo.findOne(WebhookEventSpecifications.withStripeEventId("evt_a"))).unwrap() !== null,
    );
    ok(
      (await repo.findOne(WebhookEventSpecifications.withStripeEventId("evt_b"))).unwrap() !== null,
    );
    deepStrictEqual(
      (await repo.findOne(WebhookEventSpecifications.withStripeEventId("evt_unknown"))).unwrap(),
      null,
    );
  });
});
