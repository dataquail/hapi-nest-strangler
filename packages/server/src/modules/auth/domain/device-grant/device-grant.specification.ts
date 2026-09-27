import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";

import type { DeviceGrantRoot } from "./device-grant.root.js";

const withCodeHash = (deviceCodeHash: string): Specification<DeviceGrantRoot> =>
  Spec.eq<DeviceGrantRoot, "deviceCodeHash">("deviceCodeHash", deviceCodeHash);
const withUserCode = (userCode: string): Specification<DeviceGrantRoot> =>
  Spec.eq<DeviceGrantRoot, "userCode">("userCode", userCode);

const isExpired = (grant: DeviceGrantRoot, now: Date): boolean =>
  grant.expiresAt.getTime() <= now.getTime();

export const DeviceGrantSpecifications = { withCodeHash, withUserCode, isExpired } as const;
