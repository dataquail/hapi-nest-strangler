import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { sql } from "@org/database";
import { z } from "zod";

import { Database } from "@/platform/database/database.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import {
  FindMyOrganizationsQuery,
  type FindMyOrganizationsResult,
  type FindMyOrganizationsView,
} from "./find-my-organizations.query.js";

const MyOrganizationRow = z.object({
  id: z.guid(),
  name: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
  is_admin: z.boolean(),
});

const toView = (row: z.infer<typeof MyOrganizationRow>): FindMyOrganizationsView => ({
  id: OrganizationId.parse(row.id),
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isAdmin: row.is_admin,
});

@QueryHandler(FindMyOrganizationsQuery)
export class FindMyOrganizationsHandler implements IQueryHandler<FindMyOrganizationsQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({ payload }: FindMyOrganizationsQuery): Promise<FindMyOrganizationsResult> {
    return translateDatabaseErrors(async () => {
      const rows = await this.db.any(sql.type(MyOrganizationRow)`
        SELECT
          o.*,
          EXISTS (
            SELECT 1 FROM "organization".organization_roles r
            WHERE r.organization_id = o.id AND r.user_id = ${payload.userId} AND r.role = 'admin'
          ) AS is_admin
        FROM "organization".memberships m
        JOIN "organization".organizations o ON o.id = m.organization_id
        WHERE m.user_id = ${payload.userId} AND o.deleted_at IS NULL
        ORDER BY o.created_at DESC
      `);
      return { organizations: rows.map(toView) };
    });
  }
}
