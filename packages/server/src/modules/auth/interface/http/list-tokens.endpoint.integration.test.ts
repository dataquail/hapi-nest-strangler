import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

describe.sequential("GET /auth/tokens (integration)", () => {
  const runtime = useServerTestRuntime(["auth.api_tokens", "user.users", "platform.roles"], {
    seedSuperAdminCaller: true,
  });

  it("returns the caller's minted tokens without secrets", async () => {
    const { client } = runtime.server();
    const created = await client.POST("/auth/tokens", { body: { label: "ci" } });
    ok(created.data !== undefined, JSON.stringify(created.error));
    const tokens = await client.GET("/auth/tokens");
    ok(tokens.data !== undefined, JSON.stringify(tokens.error));
    deepStrictEqual(tokens.data.length, 1);
    const [first] = tokens.data;
    ok(first !== undefined);
    deepStrictEqual(first.id, created.data.id);
    deepStrictEqual(first.label, "ci");
    deepStrictEqual(first.prefix, created.data.prefix);
    deepStrictEqual("token" in first, false);
  });

  it("is empty before any token is minted", async () => {
    const tokens = await runtime.server().client.GET("/auth/tokens");
    ok(tokens.data !== undefined, JSON.stringify(tokens.error));
    deepStrictEqual(tokens.data.length, 0);
  });
});
