import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { ApiTokenId } from "../domain/api-token/api-token.id.js";

// Secret-free projection: the display prefix and metadata, never the hash.
export type ApiTokenView = {
  readonly id: ApiTokenId;
  readonly label: string;
  readonly prefix: string;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
};

export type ListMyApiTokensPayload = { readonly userId: UserId };

export type ListMyApiTokensResult = Result<ReadonlyArray<ApiTokenView>, PersistenceUnavailable>;

export class ListMyApiTokensQuery extends Query<ListMyApiTokensResult> {
  constructor(public readonly payload: ListMyApiTokensPayload) {
    super();
  }
}
