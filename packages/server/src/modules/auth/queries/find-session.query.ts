import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { SessionId } from "../domain/session/session.id.js";

export type SessionView = { readonly id: SessionId; readonly userId: UserId };

// Read-side lifecycle outcomes, query-owned so the read path stays off the
// domain. The auth guard collapses all three to a 401.
export class SessionNotFound extends TaggedError("SessionNotFound")<{
  readonly sessionId: SessionId;
}> {}
export class SessionExpired extends TaggedError("SessionExpired")<{
  readonly sessionId: SessionId;
}> {}
export class SessionRevoked extends TaggedError("SessionRevoked")<{
  readonly sessionId: SessionId;
}> {}

export type FindSessionPayload = { readonly sessionId: SessionId };

export type FindSessionResult = Result<
  SessionView,
  SessionNotFound | SessionExpired | SessionRevoked | PersistenceUnavailable
>;

export class FindSessionQuery extends Query<FindSessionResult> {
  constructor(public readonly payload: FindSessionPayload) {
    super();
  }
}
