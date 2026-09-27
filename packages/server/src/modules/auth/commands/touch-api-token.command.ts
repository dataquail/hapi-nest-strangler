import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { ApiTokenId } from "../domain/api-token/api-token.id.js";

export type TouchApiTokenPayload = {
  readonly apiTokenId: ApiTokenId;
  readonly thresholdSeconds: number;
};

// Last-used stamp fired by the auth guard; throttled and infallible.
export type TouchApiTokenResult = Result<void, never>;

export class TouchApiTokenCommand extends Command<TouchApiTokenResult> {
  constructor(public readonly payload: TouchApiTokenPayload) {
    super();
  }
}
