import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

describe.sequential("DELETE /auth/tokens/{id} (integration)", () => {
  const runtime = useServerTestRuntime(["auth.api_tokens", "user.users", "platform.roles"], {
    seedSuperAdminCaller: true,
  });

  const mint = async () => {
    const created = await runtime.server().client.POST("/auth/tokens", { body: { label: "ci" } });
    ok(created.data !== undefined, JSON.stringify(created.error));
    return created.data.id;
  };

  it("revokes a token so it drops out of the listing", async () => {
    const { client } = runtime.server();
    const id = await mint();
    const revoked = await client.DELETE("/auth/tokens/{id}", { params: { path: { id } } });
    deepStrictEqual(revoked.response.status, 204);
    const tokens = await client.GET("/auth/tokens");
    deepStrictEqual(tokens.data?.length, 0);
  });

  it("a second revoke (now absent) fails 404 NotFound", async () => {
    const { client } = runtime.server();
    const id = await mint();
    await client.DELETE("/auth/tokens/{id}", { params: { path: { id } } });
    const again = await client.DELETE("/auth/tokens/{id}", { params: { path: { id } } });
    deepStrictEqual(again.response.status, 404);
    deepStrictEqual(again.error?._tag, "NotFound");
  });

  it("revoking an unknown id fails 404 NotFound", async () => {
    const res = await runtime.server().client.DELETE("/auth/tokens/{id}", {
      params: { path: { id: "99999999-9999-9999-9999-999999999999" } },
    });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "NotFound");
  });
});
