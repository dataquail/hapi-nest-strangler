import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { SessionId } from "./session.id.js";
import { SessionRootOps } from "./session.root-ops.js";

const id = SessionId.parse("11111111-1111-1111-1111-111111111111");
const userId = UserId.parse("22222222-2222-2222-2222-222222222222");
const now = new Date("2025-01-01T00:00:00Z");

describe("SessionRootOps", () => {
  it("create sets sliding and absolute expiry from the ttls", () => {
    const session = SessionRootOps.create({
      id,
      userId,
      subject: "sub",
      now,
      ttlSeconds: 60,
      absoluteTtlSeconds: 600,
    });
    deepStrictEqual(session.expiresAt, new Date("2025-01-01T00:01:00Z"));
    deepStrictEqual(session.absoluteExpiresAt, new Date("2025-01-01T00:10:00Z"));
    deepStrictEqual(session.revokedAt, null);
  });

  it("touch slides the expiry but never past the absolute expiry", () => {
    const session = SessionRootOps.create({
      id,
      userId,
      subject: "sub",
      now,
      ttlSeconds: 60,
      absoluteTtlSeconds: 600,
    });
    const later = new Date("2025-01-01T00:05:00Z");
    deepStrictEqual(
      SessionRootOps.touch({ session, now: later, ttlSeconds: 60 }).expiresAt,
      new Date("2025-01-01T00:06:00Z"),
    );
    const nearEnd = new Date("2025-01-01T00:09:30Z");
    const touched = SessionRootOps.touch({ session, now: nearEnd, ttlSeconds: 60 });
    deepStrictEqual(touched.expiresAt, session.absoluteExpiresAt);
    deepStrictEqual(touched.lastUsedAt, nearEnd);
  });
});
