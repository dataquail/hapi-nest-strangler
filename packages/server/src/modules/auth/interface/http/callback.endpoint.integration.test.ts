import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

// The happy path (PKCE cookie present, code exchange, session issued) needs a
// live IdP and is covered end to end by the acceptance suite and at the
// persistence boundary by the SessionRepositoryLive integration test. What
// this file locks down is the guard the real HTTP layer runs on every
// callback: a request arriving without our signed OIDC state cookie is
// rejected with 401 before any code exchange is attempted.
describe.sequential("GET /auth/callback (integration)", () => {
  const runtime = useServerTestRuntime(["auth.sessions", "user.users"]);

  it("rejects a callback with no OIDC state cookie as 401 Unauthorized", async () => {
    const res = await runtime.server().client.GET("/auth/callback", {
      params: { query: { code: "authorization-code", state: "csrf-state" } },
      redirect: "manual",
    });
    deepStrictEqual(res.response.status, 401);
    deepStrictEqual(res.error?._tag, "Unauthorized");
  });
});
