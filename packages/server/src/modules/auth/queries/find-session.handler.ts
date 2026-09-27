import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { RowSchemas, sql } from "@org/database";
import { Err, Ok } from "oxide.ts";

import { Database } from "@/platform/database/database.js";
import { UserId } from "@/platform/ids/user-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import {
  FindSessionQuery,
  type FindSessionResult,
  SessionExpired,
  SessionNotFound,
  SessionRevoked,
} from "./find-session.query.js";

@QueryHandler(FindSessionQuery)
export class FindSessionHandler implements IQueryHandler<FindSessionQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public async execute({ payload }: FindSessionQuery): Promise<FindSessionResult> {
    const found = await translateDatabaseErrors(() =>
      this.db.maybeOne(
        sql.type(
          RowSchemas.SessionRow,
        )`SELECT * FROM auth.sessions WHERE id = ${payload.sessionId}`,
      ),
    );
    if (found.isErr()) return found;
    const row = found.unwrap();
    if (row === null) return Err(new SessionNotFound({ sessionId: payload.sessionId }));
    if (row.revoked_at !== null) return Err(new SessionRevoked({ sessionId: payload.sessionId }));
    const now = Date.now();
    if (row.expires_at.getTime() <= now || row.absolute_expires_at.getTime() <= now) {
      return Err(new SessionExpired({ sessionId: payload.sessionId }));
    }
    return Ok({ id: payload.sessionId, userId: UserId.parse(row.user_id) });
  }
}
