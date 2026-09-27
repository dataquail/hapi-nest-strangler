import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

export type FindUsersUserView = {
  readonly id: UserId;
  readonly email: string;
  readonly address: {
    readonly country: string;
    readonly street: string;
    readonly postalCode: string;
  } | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type FindUsersResultView = {
  readonly users: ReadonlyArray<FindUsersUserView>;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
};

export type FindUsersPayload = { readonly page: number; readonly pageSize: number };

export type FindUsersResult = Result<FindUsersResultView, PersistenceUnavailable>;

export class FindUsersQuery extends Query<FindUsersResult> {
  constructor(public readonly payload: FindUsersPayload) {
    super();
  }
}
