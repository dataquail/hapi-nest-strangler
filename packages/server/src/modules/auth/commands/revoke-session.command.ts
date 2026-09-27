import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { SessionId } from "../domain/session/session.id.js";

export type RevokeSessionPayload = { readonly sessionId: SessionId };

// Idempotent and infallible: logout must succeed regardless of session state.
export type RevokeSessionResult = Result<void, never>;

export class RevokeSessionCommand extends Command<RevokeSessionResult> {
  constructor(public readonly payload: RevokeSessionPayload) {
    super();
  }
}
