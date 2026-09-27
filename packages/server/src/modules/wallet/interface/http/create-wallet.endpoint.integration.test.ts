import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const organizationId = "11111111-1111-1111-1111-111111111111";

describe.sequential("POST /internal/wallets (integration)", () => {
  const runtime = useServerTestRuntime(["wallet.wallets"]);

  it("opens a wallet with a zero balance for the organization", async () => {
    const res = await runtime.server().client.POST("/internal/wallets", {
      body: { organizationId },
    });
    deepStrictEqual(res.response.status, 201);
    ok(res.data !== undefined, JSON.stringify(res.error));
    deepStrictEqual(res.data.organizationId, organizationId);
    deepStrictEqual(res.data.balance, 0);
  });

  it("is idempotent: a second create returns the same wallet", async () => {
    const { client } = runtime.server();
    const first = await client.POST("/internal/wallets", { body: { organizationId } });
    const second = await client.POST("/internal/wallets", { body: { organizationId } });
    deepStrictEqual(second.response.status, 201);
    deepStrictEqual(second.data?.id, first.data?.id);
  });

  it("returns 400 BadRequest for a body without an organization id", async () => {
    const res = await runtime
      .server()
      .client.POST("/internal/wallets", { body: {} as { organizationId: string } });
    deepStrictEqual(res.response.status, 400);
    deepStrictEqual(res.error?._tag, "BadRequest");
  });

  it("returns 401 Unauthorized without the inter-service token", async () => {
    const res = await fetch(`${runtime.server().baseUrl}/internal/wallets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId }),
    });
    deepStrictEqual(res.status, 401);
    deepStrictEqual(((await res.json()) as { _tag: string })._tag, "Unauthorized");
  });
});
