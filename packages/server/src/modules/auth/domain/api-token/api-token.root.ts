import { z } from "zod";

import { UserId } from "@/platform/ids/user-id.js";

import { ApiTokenId } from "./api-token.id.js";

export const ApiTokenRoot = z
  .object({
    id: ApiTokenId,
    userId: UserId,
    tokenHash: z.string(),
    prefix: z.string(),
    label: z.string(),
    expiresAt: z.date().nullable(),
    revokedAt: z.date().nullable(),
    createdAt: z.date(),
    lastUsedAt: z.date(),
  })
  .readonly();
export type ApiTokenRoot = z.infer<typeof ApiTokenRoot>;
