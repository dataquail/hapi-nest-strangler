import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { AuthIdentitySpecifications } from "./auth-identity.specification.js";

describe("AuthIdentitySpecifications", () => {
  it("bySubject matches the subject", () => {
    const identity = {
      subject: "sub-1",
      userId: UserId.parse("11111111-1111-1111-1111-111111111111"),
      provider: "zitadel",
    };
    deepStrictEqual(AuthIdentitySpecifications.bySubject("sub-1")(identity), true);
    deepStrictEqual(AuthIdentitySpecifications.bySubject("sub-2")(identity), false);
  });
});
