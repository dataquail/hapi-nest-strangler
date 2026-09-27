import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import { Err, Ok, type Result } from "oxide.ts";

import {
  SessionNotFound,
  type SessionRevoked,
} from "@/modules/auth/domain/session/session.errors.js";
import type { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { SessionRepository } from "@/modules/auth/domain/session/session.repository.js";
import type { SessionRoot } from "@/modules/auth/domain/session/session.root.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as SessionMapper from "./session.mapper.js";

const timestampOrNull = (value: Date | null) => (value === null ? null : sql.timestamp(value));

@Injectable()
export class SessionRepositoryLive extends SessionRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  public insertOne(session: SessionRoot): Promise<Result<void, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      await this.db.exec(sql.unsafe`
        INSERT INTO auth.sessions
          (id, user_id, subject, expires_at, absolute_expires_at, revoked_at, created_at, last_used_at)
        VALUES (${session.id}, ${session.userId}, ${session.subject}, ${sql.timestamp(session.expiresAt)},
                ${sql.timestamp(session.absoluteExpiresAt)}, ${timestampOrNull(session.revokedAt)},
                ${sql.timestamp(session.createdAt)}, ${sql.timestamp(session.lastUsedAt)})
      `);
    });
  }

  public findOne(
    spec: Specification<SessionRoot>,
  ): Promise<Result<SessionRoot | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.SessionRow)`
        SELECT * FROM auth.sessions
        WHERE ${criteriaToWhere(spec.criteria, SessionMapper.columns)}
        LIMIT 1
      `);
      return row === null ? null : SessionMapper.toDomain(row);
    });
  }

  // Revocation is the delete: the row stays for the purge job to sweep.
  public async deleteOne(
    id: SessionId,
  ): Promise<Result<void, SessionNotFound | SessionRevoked | PersistenceUnavailable>> {
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`
        UPDATE auth.sessions SET revoked_at = now() WHERE id = ${id} AND revoked_at IS NULL
      `),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0 ? Err(new SessionNotFound({ sessionId: id })) : Ok(undefined);
  }

  public async updateOne(
    session: SessionRoot,
  ): Promise<Result<void, SessionNotFound | PersistenceUnavailable>> {
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`
        UPDATE auth.sessions
        SET expires_at = ${sql.timestamp(session.expiresAt)}, last_used_at = ${sql.timestamp(session.lastUsedAt)}
        WHERE id = ${session.id} AND revoked_at IS NULL
      `),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0
      ? Err(new SessionNotFound({ sessionId: session.id }))
      : Ok(undefined);
  }
}
