import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const DAY_MS = 86_400_000;

describe.sequential("POST /auth/tokens (integration)", () => {
  const runtime = useServerTestRuntime(["auth.api_tokens", "user.users", "platform.roles"], {
    seedSuperAdminCaller: true,
  });

  it("mints a token, returns the plaintext + prefix once, and defaults expiry", async () => {
    const res = await runtime
      .server()
      .client.POST("/auth/tokens", { body: { label: "ci-deploy" } });
    ok(res.data !== undefined, JSON.stringify(res.error));
    deepStrictEqual(res.response.status, 201);
    ok(res.data.token.startsWith("pat_"));
    ok(res.data.token.startsWith(res.data.prefix));
    ok(res.data.prefix.startsWith("pat_"));
    ok(!res.data.prefix.includes(res.data.token.slice(res.data.prefix.length + 1)));
    ok(res.data.expiresAt !== null);
    ok(res.data.id.length > 0);
  });

  it("honors an explicit expiresInDays", async () => {
    const res = await runtime
      .server()
      .client.POST("/auth/tokens", { body: { label: "short", expiresInDays: 1 } });
    ok(res.data !== undefined, JSON.stringify(res.error));
    ok(res.data.expiresAt !== null);
    const remaining = new Date(res.data.expiresAt).getTime() - Date.now();
    ok(remaining > 0 && remaining <= DAY_MS);
  });

  it("rejects a blank label as 400 BadRequest", async () => {
    const res = await runtime.server().client.POST("/auth/tokens", { body: { label: "" } });
    deepStrictEqual(res.response.status, 400);
    deepStrictEqual(res.error?._tag, "BadRequest");
  });
});
