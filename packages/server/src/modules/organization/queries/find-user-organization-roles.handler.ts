import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { RowSchemas, sql } from "@org/database";

import { Database } from "@/platform/database/database.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import {
  FindUserOrganizationRolesQuery,
  type FindUserOrganizationRolesResult,
  type UserOrganizationRolesView,
} from "./find-user-organization-roles.policy-query.js";

@QueryHandler(FindUserOrganizationRolesQuery)
export class FindUserOrganizationRolesHandler implements IQueryHandler<FindUserOrganizationRolesQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({
    payload,
  }: FindUserOrganizationRolesQuery): Promise<FindUserOrganizationRolesResult> {
    return translateDatabaseErrors(async (): Promise<UserOrganizationRolesView> => {
      const rows = await this.db.any(sql.type(RowSchemas.OrganizationRoleRow)`
        SELECT organization_id, user_id, role, issued_by, created_at
        FROM "organization".organization_roles
        WHERE user_id = ${payload.userId} AND organization_id = ${payload.organizationId}
        ORDER BY created_at ASC
      `);
      return {
        userId: payload.userId,
        organizationId: payload.organizationId,
        roles: rows.map((row) => row.role),
      };
    });
  }
}
