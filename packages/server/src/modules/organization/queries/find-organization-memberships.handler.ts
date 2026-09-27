import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { RowSchemas, sql } from "@org/database";

import { Database } from "@/platform/database/database.js";
import { UserId } from "@/platform/ids/user-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import { UsersLookup } from "../domain/ports/acl/users-lookup.acl.js";
import {
  FindOrganizationMembershipsQuery,
  type FindOrganizationMembershipsResult,
  type OrganizationMemberView,
} from "./find-organization-memberships.query.js";

// Emails live in the user module's schema (ADR-0020), so they arrive through
// this module's own ACL port rather than a cross-schema JOIN.
@QueryHandler(FindOrganizationMembershipsQuery)
export class FindOrganizationMembershipsHandler implements IQueryHandler<FindOrganizationMembershipsQuery> {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(UsersLookup) private readonly users: UsersLookup,
  ) {}

  public async execute({
    payload,
  }: FindOrganizationMembershipsQuery): Promise<FindOrganizationMembershipsResult> {
    const rows = await translateDatabaseErrors(async () => {
      const memberships = await this.db.any(sql.type(RowSchemas.MembershipRow)`
        SELECT * FROM "organization".memberships
        WHERE organization_id = ${payload.organizationId}
        ORDER BY created_at ASC
      `);
      const admins = await this.db.any(sql.type(RowSchemas.OrganizationRoleRow)`
        SELECT organization_id, user_id, role, issued_by, created_at
        FROM "organization".organization_roles
        WHERE organization_id = ${payload.organizationId} AND role = 'admin'
      `);
      return { memberships, adminUserIds: new Set(admins.map((row) => row.user_id)) };
    });
    if (rows.isErr()) return rows;
    const { adminUserIds, memberships } = rows.unwrap();
    const users = await this.users.findByIds(memberships.map((m) => UserId.parse(m.user_id)));
    if (users.isErr()) return users;
    const byUserId = new Map(users.unwrap().map((u) => [u.userId, u]));
    return users.map(() =>
      memberships.flatMap((row): ReadonlyArray<OrganizationMemberView> => {
        const user = byUserId.get(UserId.parse(row.user_id));
        return user === undefined
          ? []
          : [
              {
                userId: UserId.parse(row.user_id),
                email: user.email,
                joinedAt: row.created_at,
                isAdmin: adminUserIds.has(row.user_id),
              },
            ];
      }),
    );
  }
}
