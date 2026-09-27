import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { RowSchemas, sql } from "@org/database";
import { z } from "zod";

import { Database } from "@/platform/database/database.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import {
  FindAllOrganizationsQuery,
  type FindAllOrganizationsResult,
  type FindAllOrganizationsResultView,
  type FindAllOrganizationsView,
} from "./find-all-organizations.query.js";

const CountRow = z.object({ value: z.number() });

const toView = (row: RowSchemas.OrganizationRow): FindAllOrganizationsView => ({
  id: OrganizationId.parse(row.id),
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

@QueryHandler(FindAllOrganizationsQuery)
export class FindAllOrganizationsHandler implements IQueryHandler<FindAllOrganizationsQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({ payload }: FindAllOrganizationsQuery): Promise<FindAllOrganizationsResult> {
    const offset = (payload.page - 1) * payload.pageSize;
    const scope = payload.includeDeleted ? sql.fragment`TRUE` : sql.fragment`deleted_at IS NULL`;
    return translateDatabaseErrors(async (): Promise<FindAllOrganizationsResultView> => {
      const rows = await this.db.any(sql.type(RowSchemas.OrganizationRow)`
        SELECT * FROM "organization".organizations
        WHERE ${scope}
        ORDER BY created_at DESC
        LIMIT ${payload.pageSize} OFFSET ${offset}
      `);
      const count = await this.db.one(sql.type(CountRow)`
        SELECT COUNT(*)::int AS value FROM "organization".organizations WHERE ${scope}
      `);
      return {
        organizations: rows.map(toView),
        page: payload.page,
        pageSize: payload.pageSize,
        total: count.value,
      };
    });
  }
}
