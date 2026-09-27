import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { RowSchemas, sql } from "@org/database";

import { Database } from "@/platform/database/database.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import {
  FindUserRolesQuery,
  type FindUserRolesResult,
  type UserRolesView,
} from "./find-user-roles.policy-query.js";

@QueryHandler(FindUserRolesQuery)
export class FindUserRolesHandler implements IQueryHandler<FindUserRolesQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({ payload }: FindUserRolesQuery): Promise<FindUserRolesResult> {
    return translateDatabaseErrors(async (): Promise<UserRolesView> => {
      const rows = await this.db.any(sql.type(RowSchemas.PlatformRoleRow)`
        SELECT user_id, role, granted_at FROM platform.roles
        WHERE user_id = ${payload.userId}
        ORDER BY granted_at ASC
      `);
      return { userId: payload.userId, roles: rows.map((row) => row.role) };
    });
  }
}
