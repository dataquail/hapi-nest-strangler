import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { ApiTokenNotFound } from "../domain/api-token/api-token.errors.js";
import type { ApiTokenId } from "../domain/api-token/api-token.id.js";

// Scoped to the owner: someone else's token is reported as not found, never revealed.
export type RevokeApiTokenPayload = { readonly apiTokenId: ApiTokenId; readonly userId: UserId };

export type RevokeApiTokenResult = Result<void, ApiTokenNotFound | PersistenceUnavailable>;

export class RevokeApiTokenCommand extends Command<RevokeApiTokenResult> {
  constructor(public readonly payload: RevokeApiTokenPayload) {
    super();
  }
}
