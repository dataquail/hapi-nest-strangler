import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { ApiTokenId } from "../domain/api-token/api-token.id.js";

export type ApiTokenPrincipalView = { readonly id: ApiTokenId; readonly userId: UserId };

// Fieldless: a hash miss has no id to report. The auth guard collapses all three to a 401.
export class ApiTokenNotFound extends TaggedError("ApiTokenNotFound") {}
export class ApiTokenExpired extends TaggedError("ApiTokenExpired") {}
export class ApiTokenRevoked extends TaggedError("ApiTokenRevoked") {}

// The caller hashes the presented token before dispatch, so the raw secret
// never travels through the bus or a span.
export type FindApiTokenByHashPayload = { readonly tokenHash: string };

export type FindApiTokenByHashResult = Result<
  ApiTokenPrincipalView,
  ApiTokenNotFound | ApiTokenExpired | ApiTokenRevoked | PersistenceUnavailable
>;

export class FindApiTokenByHashQuery extends Query<FindApiTokenByHashResult> {
  constructor(public readonly payload: FindApiTokenByHashPayload) {
    super();
  }
}
