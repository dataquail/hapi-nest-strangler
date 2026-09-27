import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

export type UserRolesView = {
  readonly userId: UserId;
  readonly roles: ReadonlyArray<string>;
};

export type FindUserRolesPayload = { readonly userId: UserId };

// Published so other modules' authorization checks can ask "is this user a
// super admin" through their own ACL adapter (ADR-0022): a cross-module
// contract with a stability obligation an internal query does not have.
export type FindUserRolesResult = Result<UserRolesView, PersistenceUnavailable>;

export class FindUserRolesQuery extends Query<FindUserRolesResult> {
  constructor(public readonly payload: FindUserRolesPayload) {
    super();
  }
}
