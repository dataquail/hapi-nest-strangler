import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

export type CurrentUserView = { readonly userId: UserId; readonly isSuperAdmin: boolean };

export type FindCurrentUserPayload = { readonly userId: UserId };

export type FindCurrentUserResult = Result<CurrentUserView, PersistenceUnavailable>;

export class FindCurrentUserQuery extends Query<FindCurrentUserResult> {
  constructor(public readonly payload: FindCurrentUserPayload) {
    super();
  }
}
