import type { UserId } from "@/platform/ids/user-id.js";

import type { SessionId } from "./session.id.js";
import { SessionRoot } from "./session.root.js";

const addSeconds = (date: Date, seconds: number): Date => new Date(date.getTime() + seconds * 1000);

export type CreateInput = {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly subject: string;
  readonly now: Date;
  readonly ttlSeconds: number;
  readonly absoluteTtlSeconds: number;
};

const create = (input: CreateInput): SessionRoot =>
  SessionRoot.parse({
    id: input.id,
    userId: input.userId,
    subject: input.subject,
    expiresAt: addSeconds(input.now, input.ttlSeconds),
    absoluteExpiresAt: addSeconds(input.now, input.absoluteTtlSeconds),
    revokedAt: null,
    createdAt: input.now,
    lastUsedAt: input.now,
  });

export type TouchInput = {
  readonly session: SessionRoot;
  readonly now: Date;
  readonly ttlSeconds: number;
};

// Sliding expiry, capped by the absolute expiry set at sign-in.
const touch = (input: TouchInput): SessionRoot => {
  const candidate = addSeconds(input.now, input.ttlSeconds);
  const expiresAt =
    candidate.getTime() < input.session.absoluteExpiresAt.getTime()
      ? candidate
      : input.session.absoluteExpiresAt;
  return SessionRoot.parse({ ...input.session, expiresAt, lastUsedAt: input.now });
};

export const SessionRootOps = { create, touch } as const;
