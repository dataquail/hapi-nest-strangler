import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { FindUsersUserView } from "./find-users.query.js";

export type FindUsersByIdsPayload = { readonly ids: ReadonlyArray<UserId> };

export type FindUsersByIdsResult = Result<ReadonlyArray<FindUsersUserView>, PersistenceUnavailable>;

export class FindUsersByIdsQuery extends Query<FindUsersByIdsResult> {
  constructor(public readonly payload: FindUsersByIdsPayload) {
    super();
  }
}
