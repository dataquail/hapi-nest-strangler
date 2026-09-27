import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import type { Result } from "oxide.ts";

import {
  type AuthIdentity,
  AuthIdentityRepository,
} from "@/modules/auth/domain/auth-identity/auth-identity.repository.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as AuthIdentityMapper from "./auth-identity.mapper.js";

@Injectable()
export class AuthIdentityRepositoryLive extends AuthIdentityRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  public findOne(
    spec: Specification<AuthIdentity>,
  ): Promise<Result<AuthIdentity | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.AuthIdentityRow)`
        SELECT * FROM auth.auth_identities
        WHERE ${criteriaToWhere(spec.criteria, AuthIdentityMapper.columns)}
        LIMIT 1
      `);
      return row === null ? null : AuthIdentityMapper.toDomain(row);
    });
  }

  public insertOne(identity: AuthIdentity): Promise<Result<void, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      await this.db.exec(sql.unsafe`
        INSERT INTO auth.auth_identities (subject, user_id, provider, created_at)
        VALUES (${identity.subject}, ${identity.userId}, ${identity.provider}, now())
      `);
    });
  }
}
