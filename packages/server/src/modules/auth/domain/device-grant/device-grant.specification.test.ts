import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { DeviceGrantId } from "./device-grant.id.js";
import { DeviceGrantRootOps } from "./device-grant.root-ops.js";
import { DeviceGrantSpecifications } from "./device-grant.specification.js";

const now = new Date("2025-01-01T00:00:00Z");
const grant = DeviceGrantRootOps.start({
  id: DeviceGrantId.parse("11111111-1111-1111-1111-111111111111"),
  deviceCodeHash: "hash",
  userCode: "ABCD-EFGH",
  now,
  ttlSeconds: 60,
});

describe("DeviceGrantSpecifications", () => {
  it("matches by code hash and user code, and reports expiry", () => {
    deepStrictEqual(DeviceGrantSpecifications.withCodeHash("hash")(grant), true);
    deepStrictEqual(DeviceGrantSpecifications.withUserCode("ABCD-EFGH")(grant), true);
    deepStrictEqual(DeviceGrantSpecifications.isExpired(grant, now), false);
    deepStrictEqual(
      DeviceGrantSpecifications.isExpired(grant, new Date("2025-01-01T00:01:00Z")),
      true,
    );
  });
});
