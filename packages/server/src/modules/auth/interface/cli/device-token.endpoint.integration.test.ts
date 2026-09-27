import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

// Drives the full device flow through the real HTTP surface: the fake guard
// supplies the super-admin caller for the browser approve step.
describe.sequential("POST /cli/device/token (integration)", () => {
  const runtime = useServerTestRuntime(
    ["auth.device_grants", "auth.api_tokens", "user.users", "platform.roles"],
    {
      seedSuperAdminCaller: true,
    },
  );

  const start = async () => {
    const started = await runtime.server().client.POST("/cli/device/start");
    ok(started.data !== undefined, JSON.stringify(started.error));
    return started.data;
  };

  it("returns authorization_pending before approval", async () => {
    const { device_code } = await start();
    const res = await runtime.server().client.POST("/cli/device/token", { body: { device_code } });
    deepStrictEqual(res.response.status, 400);
    deepStrictEqual(res.error?._tag, "DeviceAuthorizationPending");
  });

  it("exchanges an approved grant for a bearer token, single-use", async () => {
    const { client } = runtime.server();
    const { device_code, user_code } = await start();
    const approved = await client.POST("/auth/device/approve", { body: { userCode: user_code } });
    deepStrictEqual(approved.response.status, 204);
    const res = await client.POST("/cli/device/token", { body: { device_code } });
    ok(res.data !== undefined, JSON.stringify(res.error));
    ok(res.data.access_token.startsWith("pat_"));
    deepStrictEqual(res.data.token_type, "Bearer");
    const again = await client.POST("/cli/device/token", { body: { device_code } });
    deepStrictEqual(again.error?._tag, "DeviceCodeNotFound");
  });

  it("rejects an unknown device code", async () => {
    const res = await runtime
      .server()
      .client.POST("/cli/device/token", { body: { device_code: "not-a-real-code" } });
    deepStrictEqual(res.error?._tag, "DeviceCodeNotFound");
  });
});
