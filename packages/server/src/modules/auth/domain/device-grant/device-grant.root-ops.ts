import type { UserId } from "@/platform/ids/user-id.js";

import type { DeviceGrantId } from "./device-grant.id.js";
import { DeviceGrantRoot } from "./device-grant.root.js";

export type StartInput = {
  readonly id: DeviceGrantId;
  readonly deviceCodeHash: string;
  readonly userCode: string;
  readonly now: Date;
  readonly ttlSeconds: number;
};

const start = (input: StartInput): DeviceGrantRoot =>
  DeviceGrantRoot.parse({
    id: input.id,
    deviceCodeHash: input.deviceCodeHash,
    userCode: input.userCode,
    status: "pending",
    userId: null,
    createdAt: input.now,
    expiresAt: new Date(input.now.getTime() + input.ttlSeconds * 1000),
    approvedAt: null,
  });

export type ApproveInput = {
  readonly grant: DeviceGrantRoot;
  readonly userId: UserId;
  readonly now: Date;
};

const approve = (input: ApproveInput): DeviceGrantRoot =>
  DeviceGrantRoot.parse({
    ...input.grant,
    status: "approved",
    userId: input.userId,
    approvedAt: input.now,
  });

// No 0/O/1/I: the code is typed by a human off another screen.
export const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const toUserCode = (bytes: Uint8Array): string => {
  const n = USER_CODE_ALPHABET.length;
  const limit = 256 - (256 % n);
  let chars = "";
  for (let i = 0; i < bytes.length && chars.length < 8; i++) {
    const byte = bytes[i] ?? 0;
    if (byte >= limit) continue;
    chars += USER_CODE_ALPHABET[byte % n];
  }
  if (chars.length < 8) {
    throw new Error("toUserCode: not enough random bytes to build a user code");
  }
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
};

export const DeviceGrantRootOps = { start, approve, toUserCode } as const;
