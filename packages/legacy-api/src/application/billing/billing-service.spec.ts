import { deepStrictEqual, rejects } from "node:assert";

import { describe, it, vi } from "vitest";

import BillingService = require("./billing-service");
import { createFakeGateway, FAKE_WEBHOOK_SIGNATURE } from "./fake-stripe-gateway";

type Row = Record<string, unknown>;

// A knex stub over two tables: `subscriptions` answers `first()` from the
// seeded rows and records inserts and updates; `webhook_events` refuses a
// repeated event id the way the primary key would.
const makeKnex = (subscriptions: Row[] = []) => {
  const inserts: Array<{ table: string; row: Row }> = [];
  const updates: Array<{ table: string; where: Row; patch: Row }> = [];
  const seenEvents = new Set<string>();
  const table = (name: string) => {
    let where: Row = {};
    const chain: any = {
      transacting: () => chain,
      where: (criteria: Row) => {
        where = criteria;
        return chain;
      },
      first: async () =>
        name === "subscriptions"
          ? subscriptions.find((row) => Object.entries(where).every(([k, v]) => row[k] === v))
          : undefined,
      insert: async (row: Row) => {
        if (name === "webhook_events") {
          const id = row.stripe_event_id as string;
          if (seenEvents.has(id))
            throw Object.assign(new Error("duplicate key"), { code: "23505" });
          seenEvents.add(id);
        }
        inserts.push({ table: name, row });
      },
      update: async (patch: Row) => {
        updates.push({ table: name, where, patch });
      },
    };
    return chain;
  };
  const knex: any = (name: string) => table(name);
  knex.transaction = async (work: (t: unknown) => Promise<void>) => work({});
  return { knex, inserts, updates };
};

const makeServer = () => ({ events: { emit: vi.fn() } });

const organization = (id: string) => ({ get: (key: string) => (key === "id" ? id : undefined) });

describe("BillingService", () => {
  it("creates the provider customer and subscription before the local row", async () => {
    const { inserts, knex } = makeKnex();
    const service = new BillingService({ knex } as any, createFakeGateway(), makeServer() as any);

    const result = await service.startSubscription(organization("org-1"));

    deepStrictEqual(result.status, "active");
    deepStrictEqual(result.organizationId, "org-1");
    deepStrictEqual(inserts.length, 1);
    deepStrictEqual(inserts[0].row.stripe_customer_id, "cus_test_1");
    deepStrictEqual(inserts[0].row.stripe_subscription_id, "sub_test_2");
  });

  it("announces the started subscription for the mirror once the row is in", async () => {
    const { inserts, knex } = makeKnex();
    const server = makeServer();
    const service = new BillingService({ knex } as any, createFakeGateway(), server as any);

    await service.startSubscription(organization("org-1"));

    const row = inserts[0].row;
    deepStrictEqual(server.events.emit.mock.calls, [
      [
        "mirror-subscription-started",
        {
          id: row.id,
          organizationId: "org-1",
          stripeCustomerId: "cus_test_1",
          stripeSubscriptionId: "sub_test_2",
          status: "active",
          currentPeriodEnd: (row.current_period_end as Date).toISOString(),
          createdAt: (row.created_at as Date).toISOString(),
        },
      ],
    ]);
  });

  it("refuses a second subscription for the same organization without calling the provider", async () => {
    const { inserts, knex } = makeKnex([{ organization_id: "org-1", id: "s1" }]);
    const gateway = createFakeGateway();
    gateway.createCustomer = vi.fn();
    const service = new BillingService({ knex } as any, gateway, makeServer() as any);

    await rejects(service.startSubscription(organization("org-1")), (error: any) => {
      deepStrictEqual(error.output.statusCode, 409);
      deepStrictEqual(error.output.payload._tag, "SubscriptionAlreadyExistsError");
      return true;
    });
    deepStrictEqual((gateway.createCustomer as any).mock.calls.length, 0);
    deepStrictEqual(inserts.length, 0);
  });

  it("writes nothing locally when the provider refuses the subscription", async () => {
    const { inserts, knex } = makeKnex();
    const gateway = createFakeGateway();
    gateway.createSubscription = vi.fn().mockRejectedValue(new Error("stripe down"));
    const service = new BillingService({ knex } as any, gateway, makeServer() as any);

    await rejects(service.startSubscription(organization("org-1")), /stripe down/);
    deepStrictEqual(inserts.length, 0);
  });

  it("cancels upstream before flipping the local status", async () => {
    const { knex, updates } = makeKnex([
      {
        organization_id: "org-1",
        id: "s1",
        stripe_subscription_id: "sub_9",
        status: "active",
        current_period_end: null,
      },
    ]);
    const gateway = createFakeGateway();
    const order: string[] = [];
    gateway.cancelSubscription = vi.fn(async () => {
      order.push("provider");
      return { status: "canceled", currentPeriodEnd: null };
    });
    const server = makeServer();
    const service = new BillingService({ knex } as any, gateway, server as any);

    const result = await service.cancelSubscription(organization("org-1"));

    deepStrictEqual(result.status, "canceled");
    deepStrictEqual((gateway.cancelSubscription as any).mock.calls, [
      [{ stripeSubscriptionId: "sub_9" }],
    ]);
    deepStrictEqual(updates.length, 1);
    deepStrictEqual(updates[0].patch.status, "canceled");
    deepStrictEqual(server.events.emit.mock.calls, [
      [
        "mirror-subscription-canceled",
        {
          organizationId: "org-1",
          canceledAt: (updates[0].patch.updated_at as Date).toISOString(),
        },
      ],
    ]);
  });

  it("applies a webhook once and acknowledges its redelivery without touching the subscription", async () => {
    const { inserts, knex, updates } = makeKnex();
    const service = new BillingService({ knex } as any, createFakeGateway(), makeServer() as any);
    const payload = JSON.stringify({
      eventId: "evt_1",
      type: "customer.subscription.deleted",
      subscription: { stripeSubscriptionId: "sub_9", status: "canceled", currentPeriodEnd: null },
    });

    await service.ingestStripeWebhook(payload, FAKE_WEBHOOK_SIGNATURE);
    await service.ingestStripeWebhook(payload, FAKE_WEBHOOK_SIGNATURE);

    deepStrictEqual(
      inserts.map((i) => i.table),
      ["webhook_events"],
    );
    deepStrictEqual(updates.length, 1);
    deepStrictEqual(updates[0].where, { stripe_subscription_id: "sub_9" });
    deepStrictEqual(updates[0].patch.status, "canceled");
  });

  it("rejects a webhook whose signature does not verify before consuming the event", async () => {
    const { inserts, knex } = makeKnex();
    const service = new BillingService({ knex } as any, createFakeGateway(), makeServer() as any);

    await rejects(service.ingestStripeWebhook("{}", "t=1,v1=bad"), (error: any) => {
      deepStrictEqual(error.output.statusCode, 401);
      return true;
    });
    deepStrictEqual(inserts.length, 0);
  });
});
