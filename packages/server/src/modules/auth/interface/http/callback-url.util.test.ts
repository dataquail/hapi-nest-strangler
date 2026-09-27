import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { buildCallbackUrl } from "./callback-url.util.js";

const env = "http://localhost:3001/api/auth/callback";

describe("buildCallbackUrl", () => {
  it("takes origin and path from the env and the query from the request", () => {
    const url = buildCallbackUrl(env, "/auth/callback?code=abc&state=xyz");
    deepStrictEqual(url.origin, "http://localhost:3001");
    deepStrictEqual(url.pathname, "/api/auth/callback");
    deepStrictEqual(url.searchParams.get("code"), "abc");
    deepStrictEqual(url.searchParams.get("state"), "xyz");
  });

  it("handles a request with no query string", () => {
    deepStrictEqual(buildCallbackUrl(env, "/auth/callback").search, "");
  });

  it("ignores the inbound path entirely", () => {
    const url = buildCallbackUrl(env, "/totally/different/path?code=abc");
    deepStrictEqual(url.pathname, "/api/auth/callback");
    deepStrictEqual(url.searchParams.get("code"), "abc");
  });

  it("preserves repeated query keys and https origins", () => {
    const url = buildCallbackUrl(
      "https://app.example.com/api/auth/callback",
      "/x?scope=openid&scope=profile",
    );
    deepStrictEqual(url.searchParams.getAll("scope"), ["openid", "profile"]);
    deepStrictEqual(url.origin, "https://app.example.com");
  });
});
