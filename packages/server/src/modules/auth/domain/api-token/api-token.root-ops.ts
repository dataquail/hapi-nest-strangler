import type { UserId } from "@/platform/ids/user-id.js";

import type { ApiTokenId } from "./api-token.id.js";
import { ApiTokenRoot } from "./api-token.root.js";

export type MintInput = {
  readonly id: ApiTokenId;
  readonly userId: UserId;
  readonly tokenHash: string;
  readonly prefix: string;
  readonly label: string;
  readonly now: Date;
  readonly expiresAt: Date | null;
};

const mint = (input: MintInput): ApiTokenRoot =>
  ApiTokenRoot.parse({
    id: input.id,
    userId: input.userId,
    tokenHash: input.tokenHash,
    prefix: input.prefix,
    label: input.label,
    expiresAt: input.expiresAt,
    revokedAt: null,
    createdAt: input.now,
    lastUsedAt: input.now,
  });

export type TouchInput = { readonly token: ApiTokenRoot; readonly now: Date };

const touch = (input: TouchInput): ApiTokenRoot =>
  ApiTokenRoot.parse({ ...input.token, lastUsedAt: input.now });

export const API_TOKEN_PREFIX = "pat";

// The wire form of a credential is the aggregate's own concern (ADR-0003).
const assembleToken = (publicId: string, secret: string): string =>
  `${API_TOKEN_PREFIX}_${publicId}_${secret}`;

const displayPrefix = (publicId: string): string => `${API_TOKEN_PREFIX}_${publicId}`;

export const ApiTokenRootOps = { mint, touch, assembleToken, displayPrefix } as const;
