import { z } from "zod";

import { UserId } from "@/platform/ids/user-id.js";

import { DeviceGrantId } from "./device-grant.id.js";

export const DeviceGrantRoot = z
  .object({
    id: DeviceGrantId,
    deviceCodeHash: z.string(),
    userCode: z.string(),
    status: z.enum(["pending", "approved"]),
    userId: UserId.nullable(),
    createdAt: z.date(),
    expiresAt: z.date(),
    approvedAt: z.date().nullable(),
  })
  .readonly();
export type DeviceGrantRoot = z.infer<typeof DeviceGrantRoot>;
