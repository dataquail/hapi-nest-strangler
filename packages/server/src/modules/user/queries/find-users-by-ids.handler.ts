import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { RowSchemas, sql } from "@org/database";
import { Ok } from "oxide.ts";

import { Database } from "@/platform/database/database.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import { toUserView } from "./find-users.handler.js";
import { FindUsersByIdsQuery, type FindUsersByIdsResult } from "./find-users-by-ids.query.js";

@QueryHandler(FindUsersByIdsQuery)
export class FindUsersByIdsHandler implements IQueryHandler<FindUsersByIdsQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({ payload }: FindUsersByIdsQuery): Promise<FindUsersByIdsResult> {
    if (payload.ids.length === 0) return Promise.resolve(Ok([]));
    return translateDatabaseErrors(async () => {
      const rows = await this.db.any(sql.type(RowSchemas.UserRow)`
        SELECT * FROM "user".users
        WHERE id = ANY(${sql.array([...payload.ids], "uuid")})
        ORDER BY created_at ASC
      `);
      return rows.map(toUserView);
    });
  }
}
