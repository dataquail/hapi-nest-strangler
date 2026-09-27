import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { RowSchemas, sql } from "@org/database";

import { Database } from "@/platform/database/database.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import { ApiTokenId } from "../domain/api-token/api-token.id.js";
import {
  type ApiTokenView,
  ListMyApiTokensQuery,
  type ListMyApiTokensResult,
} from "./list-my-api-tokens.query.js";

const toView = (row: RowSchemas.ApiTokenRow): ApiTokenView => ({
  id: ApiTokenId.parse(row.id),
  label: row.label,
  prefix: row.prefix,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
});

@QueryHandler(ListMyApiTokensQuery)
export class ListMyApiTokensHandler implements IQueryHandler<ListMyApiTokensQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({ payload }: ListMyApiTokensQuery): Promise<ListMyApiTokensResult> {
    return translateDatabaseErrors(async () => {
      const rows = await this.db.any(sql.type(RowSchemas.ApiTokenRow)`
        SELECT * FROM auth.api_tokens
        WHERE user_id = ${payload.userId} AND revoked_at IS NULL
        ORDER BY created_at DESC
      `);
      return rows.map(toView);
    });
  }
}
