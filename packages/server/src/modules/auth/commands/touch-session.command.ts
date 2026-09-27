import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { SessionId } from "../domain/session/session.id.js";

export type TouchSessionPayload = {
  readonly sessionId: SessionId;
  readonly ttlSeconds: number;
  readonly thresholdSeconds: number;
};

// Sliding-TTL refresh fired by the auth guard on every request; throttled and
// infallible so it can never fail a request.
export type TouchSessionResult = Result<void, never>;

export class TouchSessionCommand extends Command<TouchSessionResult> {
  constructor(public readonly payload: TouchSessionPayload) {
    super();
  }
}
