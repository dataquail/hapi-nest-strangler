import { deepStrictEqual, throws } from "node:assert";

import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { DeviceGrantId } from "./device-grant.id.js";
import { DeviceGrantRootOps, USER_CODE_ALPHABET } from "./device-grant.root-ops.js";

const id = DeviceGrantId.parse("11111111-1111-1111-1111-111111111111");
const userId = UserId.parse("22222222-2222-2222-2222-222222222222");
const now = new Date("2025-01-01T00:00:00Z");

describe("DeviceGrantRootOps", () => {
  it("start creates a pending grant with the ttl applied", () => {
    const grant = DeviceGrantRootOps.start({
      id,
      deviceCodeHash: "h",
      userCode: "ABCD-EFGH",
      now,
      ttlSeconds: 600,
    });
    deepStrictEqual(grant.status, "pending");
    deepStrictEqual(grant.expiresAt, new Date("2025-01-01T00:10:00Z"));
  });

  it("approve records the approver", () => {
    const grant = DeviceGrantRootOps.start({
      id,
      deviceCodeHash: "h",
      userCode: "ABCD-EFGH",
      now,
      ttlSeconds: 600,
    });
    const approved = DeviceGrantRootOps.approve({ grant, userId, now });
    deepStrictEqual(approved.status, "approved");
    deepStrictEqual(approved.userId, userId);
    deepStrictEqual(approved.approvedAt, now);
  });

  it("toUserCode builds XXXX-XXXX from the unambiguous alphabet, refusing too few bytes", () => {
    const code = DeviceGrantRootOps.toUserCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    deepStrictEqual(code, "ABCD-EFGH");
    deepStrictEqual(
      [...code.replace("-", "")].every((c) => USER_CODE_ALPHABET.includes(c)),
      true,
    );
    throws(() => DeviceGrantRootOps.toUserCode(new Uint8Array([1, 2, 3])));
  });
});
