import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { RowSchemas, sql } from "@org/database";
import { z } from "zod";

import { Database } from "@/platform/database/database.js";
import { UserId } from "@/platform/ids/user-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import {
  FindUsersQuery,
  type FindUsersResult,
  type FindUsersResultView,
  type FindUsersUserView,
} from "./find-users.query.js";

const CountRow = z.object({ value: z.number() });

export const toUserView = (row: RowSchemas.UserRow): FindUsersUserView => ({
  id: UserId.parse(row.id),
  email: row.email,
  address:
    row.country !== null && row.street !== null && row.postal_code !== null
      ? { country: row.country, street: row.street, postalCode: row.postal_code }
      : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

@QueryHandler(FindUsersQuery)
export class FindUsersHandler implements IQueryHandler<FindUsersQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({ payload }: FindUsersQuery): Promise<FindUsersResult> {
    const offset = (payload.page - 1) * payload.pageSize;
    return translateDatabaseErrors(async (): Promise<FindUsersResultView> => {
      const rows = await this.db.any(sql.type(RowSchemas.UserRow)`
        SELECT * FROM "user".users
        ORDER BY created_at DESC
        LIMIT ${payload.pageSize} OFFSET ${offset}
      `);
      const count = await this.db.one(sql.type(CountRow)`
        SELECT COUNT(*)::int AS value FROM "user".users
      `);
      return {
        users: rows.map(toUserView),
        page: payload.page,
        pageSize: payload.pageSize,
        total: count.value,
      };
    });
  }
}
