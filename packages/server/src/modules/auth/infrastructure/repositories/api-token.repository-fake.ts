import { Err, Ok, type Result } from "oxide.ts";

import { ApiTokenNotFound } from "@/modules/auth/domain/api-token/api-token.errors.js";
import type { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.js";
import type { ApiTokenRoot } from "@/modules/auth/domain/api-token/api-token.root.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

export class ApiTokenRepositoryFake extends ApiTokenRepository {
  private readonly store = new Map<ApiTokenId, ApiTokenRoot>();

  public insertOne(token: ApiTokenRoot): Promise<Result<void, PersistenceUnavailable>> {
    this.store.set(token.id, token);
    return Promise.resolve(Ok(undefined));
  }

  public findOne(
    spec: Specification<ApiTokenRoot>,
  ): Promise<Result<ApiTokenRoot | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].find(spec) ?? null));
  }

  public findMany(
    spec: Specification<ApiTokenRoot>,
  ): Promise<Result<ReadonlyArray<ApiTokenRoot>, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].filter(spec)));
  }

  public deleteOne(
    id: ApiTokenId,
  ): Promise<Result<void, ApiTokenNotFound | PersistenceUnavailable>> {
    const found = this.store.get(id);
    if (found === undefined || found.revokedAt !== null)
      return Promise.resolve(Err(new ApiTokenNotFound({})));
    this.store.set(id, { ...found, revokedAt: new Date() });
    return Promise.resolve(Ok(undefined));
  }

  public updateOne(
    token: ApiTokenRoot,
  ): Promise<Result<void, ApiTokenNotFound | PersistenceUnavailable>> {
    const found = this.store.get(token.id);
    if (found === undefined || found.revokedAt !== null)
      return Promise.resolve(Err(new ApiTokenNotFound({})));
    this.store.set(token.id, token);
    return Promise.resolve(Ok(undefined));
  }
}
