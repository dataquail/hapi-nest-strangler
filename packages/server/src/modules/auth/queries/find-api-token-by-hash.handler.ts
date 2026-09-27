import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { RowSchemas, sql } from "@org/database";
import { Err, Ok } from "oxide.ts";

import { Database } from "@/platform/database/database.js";
import { UserId } from "@/platform/ids/user-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import { ApiTokenId } from "../domain/api-token/api-token.id.js";
import {
  ApiTokenExpired,
  ApiTokenNotFound,
  ApiTokenRevoked,
  FindApiTokenByHashQuery,
  type FindApiTokenByHashResult,
} from "./find-api-token-by-hash.query.js";

@QueryHandler(FindApiTokenByHashQuery)
export class FindApiTokenByHashHandler implements IQueryHandler<FindApiTokenByHashQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public async execute({ payload }: FindApiTokenByHashQuery): Promise<FindApiTokenByHashResult> {
    const found = await translateDatabaseErrors(() =>
      this.db.maybeOne(
        sql.type(
          RowSchemas.ApiTokenRow,
        )`SELECT * FROM auth.api_tokens WHERE token_hash = ${payload.tokenHash}`,
      ),
    );
    if (found.isErr()) return found;
    const row = found.unwrap();
    if (row === null) return Err(new ApiTokenNotFound({}));
    if (row.revoked_at !== null) return Err(new ApiTokenRevoked({}));
    if (row.expires_at !== null && row.expires_at.getTime() <= Date.now())
      return Err(new ApiTokenExpired({}));
    return Ok({ id: ApiTokenId.parse(row.id), userId: UserId.parse(row.user_id) });
  }
}
