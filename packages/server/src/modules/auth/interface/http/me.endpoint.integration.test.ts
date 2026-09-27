import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { MEMBER_CALLER } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

// The fake guard attaches a deterministic caller, so no cookie is required and
// no IdP is involved. The real cookie and bearer paths are covered by the
// AuthenticatorLive integration test.
describe.sequential("GET /auth/me (integration)", () => {
  const runtime = useServerTestRuntime(["user.users", "platform.roles"], {
    seedSuperAdminCaller: true,
  });

  it("returns the fake super-admin caller", async () => {
    const res = await runtime.server().client.GET("/auth/me");
    ok(res.data !== undefined, JSON.stringify(res.error));
    deepStrictEqual(res.data.userId, "00000000-0000-0000-0000-000000000001");
    deepStrictEqual(res.data.isSuperAdmin, true);
  });
});

describe.sequential("GET /auth/me (integration, member caller)", () => {
  const runtime = useServerTestRuntime(["user.users", "platform.roles"], {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("reports isSuperAdmin false for an ordinary caller", async () => {
    const res = await runtime.server().client.GET("/auth/me");
    ok(res.data !== undefined, JSON.stringify(res.error));
    deepStrictEqual(res.data.userId, "00000000-0000-0000-0000-000000000002");
    deepStrictEqual(res.data.isSuperAdmin, false);
  });
});
