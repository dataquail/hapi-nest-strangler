import { z } from "zod";

import { UserId } from "@/platform/ids/user-id.js";

import { SessionId } from "./session.id.js";

export const SessionRoot = z
  .object({
    id: SessionId,
    userId: UserId,
    subject: z.string(),
    expiresAt: z.date(),
    absoluteExpiresAt: z.date(),
    revokedAt: z.date().nullable(),
    createdAt: z.date(),
    lastUsedAt: z.date(),
  })
  .readonly();
export type SessionRoot = z.infer<typeof SessionRoot>;
