import { deepStrictEqual } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import config = require("../../../config");
import { closeKnex, getKnex, truncateAll } from "../../helpers/db";
import { startFakeWalletServer } from "../../helpers/fake-wallet-server";
import { signedInAs } from "../../helpers/sessions";
import { getServer } from "../../server";

type Session = Awaited<ReturnType<typeof signedInAs>>;

const orgId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const subscription = {
  id: "11111111-1111-1111-1111-111111111111",
  organizationId: orgId,
  status: "active",
  currentPeriodEnd: "2026-11-04T00:00:00.000Z",
};

// Every billing route forwards to the Nest server and relays its answer;
// these tests hold the forward and the relay, not what the Nest server does.
describe.sequential("billing routes (integration)", () => {
  let server: Awaited<ReturnType<typeof getServer>>;
  let nest: Awaited<ReturnType<typeof startFakeWalletServer>>;
  let owner: Session;

  beforeAll(async () => {
    nest = await startFakeWalletServer(config("/auth/interServiceJWTSecret"));
    server = await getServer();
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
    await nest.stop();
    await closeKnex();
  });

  beforeEach(async () => {
    await truncateAll();
    owner = await signedInAs("owner@example.com");
    nest.calls.length = 0;
    nest.userApiAnswers(200, subscription);
  });

  const body = (res: { payload: string }) => JSON.parse(res.payload);

  const routes = [
    { method: "POST", url: `/orgs/${orgId}/billing/subscriptions`, payload: {} },
    { method: "GET", url: `/orgs/${orgId}/billing/subscriptions/current`, payload: undefined },
    { method: "DELETE", url: `/orgs/${orgId}/billing/subscriptions/current`, payload: undefined },
  ];

  for (const route of routes) {
    it(`forwards ${route.method} ${route.url} with the caller's cookie and relays the answer`, async () => {
      const res = await server.inject({
        method: route.method,
        url: route.url,
        headers: owner.headers,
        ...(route.payload === undefined ? {} : { payload: route.payload }),
      });

      deepStrictEqual(res.statusCode, 200);
      deepStrictEqual(body(res), subscription);
      const call = await nest.waitForCall(
        (one) => one.path === new URL(route.url, "http://x").pathname,
      );
      deepStrictEqual(call.method, route.method);
      deepStrictEqual(call.cookie, owner.headers.cookie);
      deepStrictEqual(call.tokenValid, false);
    });
  }

  it("relays a refusal as the Nest server gave it", async () => {
    nest.userApiAnswers(403, { _tag: "Forbidden", message: "not an admin" });
    const res = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/billing/subscriptions`,
      headers: owner.headers,
      payload: {},
    });
    deepStrictEqual(res.statusCode, 403);
    deepStrictEqual(body(res)._tag, "Forbidden");
  });

  it("forwards a Stripe webhook's bytes and signature untouched", async () => {
    nest.userApiAnswers(204, null);
    const raw = '{"eventId":"evt_1",  "type":"unknown"}';
    const res = await server.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "stripe-signature": "t=1,v1=abc", "content-type": "application/json" },
      payload: raw,
    });

    deepStrictEqual(res.statusCode, 204);
    const call = await nest.waitForCall((one) => one.path === "/webhooks/stripe");
    deepStrictEqual(call.stripeSignature, "t=1,v1=abc");
    deepStrictEqual(String(call.payload), raw);
  });

  it("writes nothing to the legacy tables", async () => {
    await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/billing/subscriptions`,
      headers: owner.headers,
      payload: {},
    });
    deepStrictEqual(await getKnex()("subscriptions"), []);
    deepStrictEqual(await getKnex()("webhook_events"), []);
  });
});
