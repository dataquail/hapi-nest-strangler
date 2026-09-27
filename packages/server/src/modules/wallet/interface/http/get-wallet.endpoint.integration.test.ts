import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const organizationId = "11111111-1111-1111-1111-111111111111";
const otherOrgId = "22222222-2222-2222-2222-222222222222";

describe.sequential("GET /internal/wallets/{organizationId} (integration)", () => {
  const runtime = useServerTestRuntime(["wallet.wallets"]);

  it("returns the organization's wallet", async () => {
    const { client } = runtime.server();
    const created = await client.POST("/internal/wallets", { body: { organizationId } });
    const res = await client.GET("/internal/wallets/{organizationId}", {
      params: { path: { organizationId } },
    });
    deepStrictEqual(res.response.status, 200);
    deepStrictEqual(res.data, created.data);
  });

  it("returns 404 WalletNotFoundError for an organization without a wallet", async () => {
    const res = await runtime.server().client.GET("/internal/wallets/{organizationId}", {
      params: { path: { organizationId: otherOrgId } },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "WalletNotFoundError");
  });

  it("returns 401 Unauthorized without the inter-service token", async () => {
    const res = await fetch(`${runtime.server().baseUrl}/internal/wallets/${organizationId}`);
    deepStrictEqual(res.status, 401);
  });
});
