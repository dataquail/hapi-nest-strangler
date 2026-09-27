import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { ApiTokenId } from "./api-token.id.js";
import { ApiTokenRootOps } from "./api-token.root-ops.js";
import { ApiTokenSpecifications } from "./api-token.specification.js";

const id = ApiTokenId.parse("11111111-1111-1111-1111-111111111111");
const userId = UserId.parse("22222222-2222-2222-2222-222222222222");
const now = new Date("2025-01-01T00:00:00Z");
const token = ApiTokenRootOps.mint({
  id,
  userId,
  tokenHash: "h",
  prefix: "p",
  label: "l",
  now,
  expiresAt: new Date("2025-02-01T00:00:00Z"),
});

describe("ApiTokenSpecifications", () => {
  it("forUser matches active tokens of the user only", () => {
    deepStrictEqual(ApiTokenSpecifications.forUser(userId)(token), true);
    deepStrictEqual(ApiTokenSpecifications.forUser(userId)({ ...token, revokedAt: now }), false);
  });

  it("isExpired compares against the expiry, and never expires a null expiry", () => {
    deepStrictEqual(ApiTokenSpecifications.isExpired(token, now), false);
    deepStrictEqual(
      ApiTokenSpecifications.isExpired(token, new Date("2025-02-01T00:00:00Z")),
      true,
    );
    deepStrictEqual(
      ApiTokenSpecifications.isExpired({ ...token, expiresAt: null }, new Date("2030-01-01")),
      false,
    );
  });
});
