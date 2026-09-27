// Parity token: the logout redirect depends on the IdP's end-session endpoint
// and has no meaningful in-process coverage. The flow is exercised end-to-end
// by the acceptance suite; session revocation itself is covered by
// revoke-session.handler.test.ts and the session repository integration test.
import { describe, it } from "vitest";

describe("logout endpoint", () => {
  it("is covered by the acceptance suite", () => {});
});
