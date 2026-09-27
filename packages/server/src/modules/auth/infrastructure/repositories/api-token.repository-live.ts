import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import { Err, Ok, type Result } from "oxide.ts";

import { ApiTokenNotFound } from "@/modules/auth/domain/api-token/api-token.errors.js";
import type { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.js";
import type { ApiTokenRoot } from "@/modules/auth/domain/api-token/api-token.root.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as ApiTokenMapper from "./api-token.mapper.js";

const timestampOrNull = (value: Date | null) => (value === null ? null : sql.timestamp(value));

@Injectable()
export class ApiTokenRepositoryLive extends ApiTokenRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  public insertOne(token: ApiTokenRoot): Promise<Result<void, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      await this.db.exec(sql.unsafe`
        INSERT INTO auth.api_tokens
          (id, user_id, token_hash, prefix, label, expires_at, revoked_at, created_at, last_used_at)
        VALUES (${token.id}, ${token.userId}, ${token.tokenHash}, ${token.prefix}, ${token.label},
                ${timestampOrNull(token.expiresAt)}, ${timestampOrNull(token.revokedAt)},
                ${sql.timestamp(token.createdAt)}, ${sql.timestamp(token.lastUsedAt)})
      `);
    });
  }

  public findOne(
    spec: Specification<ApiTokenRoot>,
  ): Promise<Result<ApiTokenRoot | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.ApiTokenRow)`
        SELECT * FROM auth.api_tokens
        WHERE ${criteriaToWhere(spec.criteria, ApiTokenMapper.columns)}
        LIMIT 1
      `);
      return row === null ? null : ApiTokenMapper.toDomain(row);
    });
  }

  public findMany(
    spec: Specification<ApiTokenRoot>,
  ): Promise<Result<ReadonlyArray<ApiTokenRoot>, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const rows = await this.db.any(sql.type(RowSchemas.ApiTokenRow)`
        SELECT * FROM auth.api_tokens
        WHERE ${criteriaToWhere(spec.criteria, ApiTokenMapper.columns)}
        ORDER BY created_at DESC
      `);
      return rows.map(ApiTokenMapper.toDomain);
    });
  }

  public async deleteOne(
    id: ApiTokenId,
  ): Promise<Result<void, ApiTokenNotFound | PersistenceUnavailable>> {
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`
        UPDATE auth.api_tokens SET revoked_at = now() WHERE id = ${id} AND revoked_at IS NULL
      `),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0 ? Err(new ApiTokenNotFound({})) : Ok(undefined);
  }

  public async updateOne(
    token: ApiTokenRoot,
  ): Promise<Result<void, ApiTokenNotFound | PersistenceUnavailable>> {
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`
        UPDATE auth.api_tokens SET last_used_at = ${sql.timestamp(token.lastUsedAt)}
        WHERE id = ${token.id} AND revoked_at IS NULL
      `),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0 ? Err(new ApiTokenNotFound({})) : Ok(undefined);
  }
}
