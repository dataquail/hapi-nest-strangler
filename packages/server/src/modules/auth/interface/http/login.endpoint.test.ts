// Parity token: the OIDC login redirect has no meaningful in-process coverage.
// The flow is exercised end-to-end by the acceptance suite against a real IdP;
// the PKCE cookie codec it relies on is pinned by oidc-pkce-cookie.util.test.ts.
import { describe, it } from "vitest";

describe("login endpoint", () => {
  it("is covered by the acceptance suite", () => {});
});
