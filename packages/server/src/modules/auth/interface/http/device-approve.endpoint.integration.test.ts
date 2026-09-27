import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

// The fake guard supplies the approving super-admin caller.
describe.sequential("POST /auth/device/approve (integration)", () => {
  const runtime = useServerTestRuntime(
    ["auth.device_grants", "auth.api_tokens", "user.users", "platform.roles"],
    {
      seedSuperAdminCaller: true,
    },
  );

  it("approves a pending grant so the CLI can then exchange it", async () => {
    const { client } = runtime.server();
    const started = await client.POST("/cli/device/start");
    ok(started.data !== undefined, JSON.stringify(started.error));
    const approved = await client.POST("/auth/device/approve", {
      body: { userCode: started.data.user_code },
    });
    deepStrictEqual(approved.response.status, 204);
    const exchanged = await client.POST("/cli/device/token", {
      body: { device_code: started.data.device_code },
    });
    ok(exchanged.data !== undefined, JSON.stringify(exchanged.error));
    ok(exchanged.data.access_token.startsWith("pat_"));
  });

  it("fails 404 for an unknown user code", async () => {
    const res = await runtime
      .server()
      .client.POST("/auth/device/approve", { body: { userCode: "ZZZZ-9999" } });
    deepStrictEqual(res.response.status, 404);
    deepStrictEqual(res.error?._tag, "NotFound");
  });
});
