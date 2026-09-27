import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

// Public endpoint: no caller identity needed.
describe.sequential("POST /cli/device/start (integration)", () => {
  const runtime = useServerTestRuntime(["auth.device_grants"]);

  it("returns device + user codes and a verification URL", async () => {
    const res = await runtime.server().client.POST("/cli/device/start");
    ok(res.data !== undefined, JSON.stringify(res.error));
    deepStrictEqual(res.response.status, 201);
    ok(res.data.device_code.length > 0);
    ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(res.data.user_code));
    ok(res.data.verification_uri.endsWith("/device"));
    ok(res.data.verification_uri_complete.includes(encodeURIComponent(res.data.user_code)));
    ok(res.data.interval > 0);
    ok(res.data.expires_in > 0);
  });
});
