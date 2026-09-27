import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";

import type { SessionId } from "./session.id.js";

export class SessionNotFound extends TaggedError("SessionNotFound")<{
  readonly sessionId: SessionId;
}> {}
export class SessionExpired extends TaggedError("SessionExpired")<{
  readonly sessionId: SessionId;
}> {}
export class SessionRevoked extends TaggedError("SessionRevoked")<{
  readonly sessionId: SessionId;
}> {}
