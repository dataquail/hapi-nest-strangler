import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const organizationId = "11111111-1111-1111-1111-111111111111";

describe.sequential("DELETE /internal/wallets/{organizationId} (integration)", () => {
  const runtime = useServerTestRuntime(["wallet.wallets"]);

  it("removes the organization's wallet", async () => {
    const { client } = runtime.server();
    await client.POST("/internal/wallets", { body: { organizationId } });
    const deleted = await client.DELETE("/internal/wallets/{organizationId}", {
      params: { path: { organizationId } },
    });
    deepStrictEqual(deleted.response.status, 204);
    const after = await client.GET("/internal/wallets/{organizationId}", {
      params: { path: { organizationId } },
    });
    deepStrictEqual(after.response.status, 404);
  });

  it("is idempotent: deleting a wallet that does not exist answers 204", async () => {
    const res = await runtime.server().client.DELETE("/internal/wallets/{organizationId}", {
      params: { path: { organizationId } },
    });
    deepStrictEqual(res.response.status, 204);
  });

  it("returns 401 Unauthorized without the inter-service token", async () => {
    const res = await fetch(`${runtime.server().baseUrl}/internal/wallets/${organizationId}`, {
      method: "DELETE",
    });
    deepStrictEqual(res.status, 401);
  });
});
