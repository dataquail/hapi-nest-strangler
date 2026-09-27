import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import type { Result } from "oxide.ts";

import { RolesRepository } from "@/modules/role/domain/roles/roles.repository.js";
import type { RolesRoot } from "@/modules/role/domain/roles/roles.root.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as RoleMapper from "./role.mapper.js";

@Injectable()
export class RolesRepositoryLive extends RolesRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  // The aggregate is the whole set of a user's roles, so an upsert replaces the
  // set: rows no longer held are deleted, held ones inserted if absent.
  public upsertOne(roles: RolesRoot): Promise<Result<void, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      await this.db.exec(sql.unsafe`
        DELETE FROM platform.roles
        WHERE user_id = ${roles.userId}
          AND NOT (role = ANY(${sql.array([...roles.roles], "text")}))
      `);
      for (const role of roles.roles) {
        await this.db.exec(sql.unsafe`
          INSERT INTO platform.roles (user_id, role)
          VALUES (${roles.userId}, ${role})
          ON CONFLICT (user_id, role) DO NOTHING
        `);
      }
    });
  }

  public findOne(
    spec: Specification<RolesRoot>,
  ): Promise<Result<RolesRoot | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const rows = await this.db.any(sql.type(RowSchemas.PlatformRoleRow)`
        SELECT user_id, role, granted_at FROM platform.roles
        WHERE ${criteriaToWhere(spec.criteria, RoleMapper.columns)}
        ORDER BY granted_at ASC
      `);
      const first = rows[0];
      return first === undefined ? null : RoleMapper.toDomain(first.user_id, rows);
    });
  }
}
