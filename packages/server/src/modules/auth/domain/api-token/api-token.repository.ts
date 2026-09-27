import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

import type { ApiTokenNotFound } from "./api-token.errors.js";
import type { ApiTokenId } from "./api-token.id.js";
import type { ApiTokenRoot } from "./api-token.root.js";

export abstract class ApiTokenRepository {
  public abstract insertOne(token: ApiTokenRoot): Promise<Result<void, PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<ApiTokenRoot>,
  ): Promise<Result<ApiTokenRoot | null, PersistenceUnavailable>>;
  public abstract findMany(
    spec: Specification<ApiTokenRoot>,
  ): Promise<Result<ReadonlyArray<ApiTokenRoot>, PersistenceUnavailable>>;
  public abstract deleteOne(
    id: ApiTokenId,
  ): Promise<Result<void, ApiTokenNotFound | PersistenceUnavailable>>;
  public abstract updateOne(
    token: ApiTokenRoot,
  ): Promise<Result<void, ApiTokenNotFound | PersistenceUnavailable>>;
}
