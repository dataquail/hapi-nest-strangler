import { deepStrictEqual } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import config = require("../../../config");
import { FAKE_WEBHOOK_SIGNATURE } from "../../../src/application/billing/fake-stripe-gateway";
import { closeKnex, getKnex, truncateAll } from "../../helpers/db";
import { startFakeWalletServer } from "../../helpers/fake-wallet-server";
import { signedInAs } from "../../helpers/sessions";
import { getServer } from "../../server";

type Session = Awaited<ReturnType<typeof signedInAs>>;

describe.sequential("billing routes (integration)", () => {
  let server: Awaited<ReturnType<typeof getServer>>;
  let wallets: Awaited<ReturnType<typeof startFakeWalletServer>>;

  beforeAll(async () => {
    wallets = await startFakeWalletServer(config("/auth/interServiceJWTSecret"));
    server = await getServer();
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
    await wallets.stop();
    await closeKnex();
  });

  beforeEach(async () => {
    await truncateAll();
    wallets.calls.length = 0;
    wallets.refuseMirrors(false);
  });

  const body = (res: { payload: string }) => JSON.parse(res.payload);
  const createOrg = async (owner: Session) =>
    body(
      await server.inject({
        method: "POST",
        url: "/orgs",
        headers: owner.headers,
        payload: { name: "Acme" },
      }),
    ).id as string;
  const webhook = (event: unknown, signature = FAKE_WEBHOOK_SIGNATURE) =>
    server.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      payload: JSON.stringify(event),
    });

  it("starts, reads and cancels a subscription; admins commit, members only read", async () => {
    const owner = await signedInAs("owner@example.com");
    const member = await signedInAs("member@example.com");
    const orgId = await createOrg(owner);
    await getKnex()("memberships").insert({ user_id: member.userId, organization_id: orgId });

    const missing = await server.inject({
      method: "GET",
      url: `/orgs/${orgId}/billing/subscriptions/current`,
      headers: member.headers,
    });
    deepStrictEqual(missing.statusCode, 404);
    deepStrictEqual(body(missing)._tag, "SubscriptionNotFoundError");

    const memberStarts = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/billing/subscriptions`,
      headers: member.headers,
      payload: {},
    });
    deepStrictEqual(memberStarts.statusCode, 403);

    const started = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/billing/subscriptions`,
      headers: owner.headers,
      payload: {},
    });
    deepStrictEqual(started.statusCode, 201);
    deepStrictEqual(body(started).status, "active");
    deepStrictEqual(body(started).organizationId, orgId);

    const again = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/billing/subscriptions`,
      headers: owner.headers,
      payload: {},
    });
    deepStrictEqual(again.statusCode, 409);
    deepStrictEqual(body(again)._tag, "SubscriptionAlreadyExistsError");

    const read = await server.inject({
      method: "GET",
      url: `/orgs/${orgId}/billing/subscriptions/current`,
      headers: member.headers,
    });
    deepStrictEqual(body(read), body(started));

    const canceled = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}/billing/subscriptions/current`,
      headers: owner.headers,
    });
    deepStrictEqual(canceled.statusCode, 200);
    deepStrictEqual(body(canceled).status, "canceled");
    deepStrictEqual((await getKnex()("subscriptions").first()).status, "canceled");

    const stranger = await signedInAs("stranger@example.com");
    const forbidden = await server.inject({
      method: "GET",
      url: `/orgs/${orgId}/billing/subscriptions/current`,
      headers: stranger.headers,
    });
    deepStrictEqual(forbidden.statusCode, 403);
  });

  it("mirrors a started subscription to the Nest server under the same ids", async () => {
    const owner = await signedInAs("owner@example.com");
    const orgId = await createOrg(owner);
    const started = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/billing/subscriptions`,
      headers: owner.headers,
      payload: {},
    });
    const row = await getKnex()("subscriptions").first();

    const call = await wallets.waitForCall(
      (one) => one.path === `/internal/orgs/${orgId}/billing/subscriptions`,
    );
    deepStrictEqual(call.method, "POST");
    deepStrictEqual(call.tokenValid, true);
    deepStrictEqual(call.payload, {
      id: body(started).id,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      status: "active",
      currentPeriodEnd: body(started).currentPeriodEnd,
      createdAt: new Date(row.created_at).toISOString(),
    });
  });

  it("answers a start the Nest server refuses to mirror, since hapi is the source of truth", async () => {
    wallets.refuseMirrors(true);
    const owner = await signedInAs("owner@example.com");
    const orgId = await createOrg(owner);
    const started = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/billing/subscriptions`,
      headers: owner.headers,
      payload: {},
    });
    deepStrictEqual(started.statusCode, 201);
    await wallets.waitForCall((one) => one.path.endsWith("/billing/subscriptions"));
    deepStrictEqual((await getKnex()("subscriptions")).length, 1);
  });

  it("ingests Stripe webhooks once each, syncing the subscription status", async () => {
    const owner = await signedInAs("owner@example.com");
    const orgId = await createOrg(owner);
    const started = body(
      await server.inject({
        method: "POST",
        url: `/orgs/${orgId}/billing/subscriptions`,
        headers: owner.headers,
        payload: {},
      }),
    );
    const stripeSubscriptionId = (await getKnex()("subscriptions").first()).stripe_subscription_id;

    const updated = await webhook({
      eventId: "evt_1",
      type: "customer.subscription.updated",
      subscription: {
        stripeSubscriptionId,
        status: "past_due",
        currentPeriodEnd: "2030-01-01T00:00:00.000Z",
      },
    });
    deepStrictEqual(updated.statusCode, 204);
    const afterUpdate = body(
      await server.inject({
        method: "GET",
        url: `/orgs/${orgId}/billing/subscriptions/current`,
        headers: owner.headers,
      }),
    );
    deepStrictEqual(afterUpdate.status, "past_due");
    deepStrictEqual(afterUpdate.currentPeriodEnd, "2030-01-01T00:00:00.000Z");
    deepStrictEqual(afterUpdate.id, started.id);

    // Replayed delivery: acknowledged, applied once.
    deepStrictEqual(
      (
        await webhook({
          eventId: "evt_1",
          type: "customer.subscription.updated",
          subscription: { stripeSubscriptionId, status: "active", currentPeriodEnd: null },
        })
      ).statusCode,
      204,
    );
    deepStrictEqual((await getKnex()("subscriptions").first()).status, "past_due");
    deepStrictEqual((await getKnex()("webhook_events")).length, 1);

    const deleted = await webhook({
      eventId: "evt_2",
      type: "customer.subscription.deleted",
      subscription: { stripeSubscriptionId, status: "canceled", currentPeriodEnd: null },
    });
    deepStrictEqual(deleted.statusCode, 204);
    deepStrictEqual((await getKnex()("subscriptions").first()).status, "canceled");

    deepStrictEqual((await webhook({ eventId: "evt_3", type: "unknown" })).statusCode, 204);
    deepStrictEqual(
      (await webhook({ eventId: "evt_4", type: "invoice.paid", invoice: { stripeSubscriptionId } }))
        .statusCode,
      204,
    );
    deepStrictEqual((await getKnex()("webhook_events")).length, 4);
  });

  it("refuses a webhook with a bad signature, a missing signature or no body", async () => {
    const bad = await webhook({ eventId: "evt_x", type: "unknown" }, "t=1,v1=nope");
    deepStrictEqual(bad.statusCode, 401);
    deepStrictEqual(body(bad)._tag, "Unauthorized");
    const missing = await server.inject({ method: "POST", url: "/webhooks/stripe", payload: "{}" });
    deepStrictEqual(missing.statusCode, 401);
    const empty = await server.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "stripe-signature": FAKE_WEBHOOK_SIGNATURE },
    });
    deepStrictEqual(empty.statusCode, 400);
    deepStrictEqual(await getKnex()("webhook_events"), []);
  });
});
