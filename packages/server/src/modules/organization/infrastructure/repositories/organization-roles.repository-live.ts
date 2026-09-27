import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import type { Result } from "oxide.ts";

import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.js";
import type { OrganizationRolesRoot } from "@/modules/organization/domain/organization-roles/organization-roles.root.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as OrganizationRolesMapper from "./organization-roles.mapper.js";

@Injectable()
export class OrganizationRolesRepositoryLive extends OrganizationRolesRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  // The aggregate is the whole set of a member's roles in one org, replaced as a set.
  public upsertOne(
    organizationRoles: OrganizationRolesRoot,
  ): Promise<Result<void, PersistenceUnavailable>> {
    return translateDatabaseErrors(() =>
      this.db.withTransaction(async () => {
        await this.db.exec(sql.unsafe`
          DELETE FROM "organization".organization_roles
          WHERE user_id = ${organizationRoles.userId}
            AND organization_id = ${organizationRoles.organizationId}
        `);
        for (const granted of organizationRoles.roles) {
          await this.db.exec(sql.unsafe`
            INSERT INTO "organization".organization_roles (organization_id, user_id, role, issued_by)
            VALUES (${organizationRoles.organizationId}, ${organizationRoles.userId}, ${granted.role}, ${granted.issuedBy})
          `);
        }
      }),
    );
  }

  public findOne(
    spec: Specification<OrganizationRolesRoot>,
  ): Promise<Result<OrganizationRolesRoot | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const rows = await this.db.any(sql.type(RowSchemas.OrganizationRoleRow)`
        SELECT organization_id, user_id, role, issued_by, created_at
        FROM "organization".organization_roles
        WHERE ${criteriaToWhere(spec.criteria, OrganizationRolesMapper.columns)}
        ORDER BY created_at ASC
      `);
      return OrganizationRolesMapper.toDomain(rows);
    });
  }
}
