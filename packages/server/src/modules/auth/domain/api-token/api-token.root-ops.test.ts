import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { ApiTokenId } from "./api-token.id.js";
import { ApiTokenRootOps } from "./api-token.root-ops.js";

const id = ApiTokenId.parse("11111111-1111-1111-1111-111111111111");
const userId = UserId.parse("22222222-2222-2222-2222-222222222222");
const now = new Date("2025-01-01T00:00:00Z");

describe("ApiTokenRootOps", () => {
  it("mint builds an active token; touch only moves lastUsedAt", () => {
    const token = ApiTokenRootOps.mint({
      id,
      userId,
      tokenHash: "h",
      prefix: "pat_ab",
      label: "cli",
      now,
      expiresAt: null,
    });
    deepStrictEqual(token.revokedAt, null);
    const later = new Date("2025-01-02T00:00:00Z");
    const touched = ApiTokenRootOps.touch({ token, now: later });
    deepStrictEqual(touched.lastUsedAt, later);
    deepStrictEqual(touched.createdAt, now);
  });

  it("assembles the wire form and the display prefix", () => {
    deepStrictEqual(ApiTokenRootOps.assembleToken("1a2b", "s3cr3t"), "pat_1a2b_s3cr3t");
    deepStrictEqual(ApiTokenRootOps.displayPrefix("1a2b"), "pat_1a2b");
  });
});
