import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import { Err, Ok, type Result } from "oxide.ts";

import { OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.js";
import type { OrganizationRoot } from "@/modules/organization/domain/organization/organization.root.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as OrganizationMapper from "./organization.mapper.js";

const timestampOrNull = (value: Date | null) => (value === null ? null : sql.timestamp(value));

@Injectable()
export class OrganizationRepositoryLive extends OrganizationRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  public insertOne(organization: OrganizationRoot): Promise<Result<void, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      await this.db.exec(sql.unsafe`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${organization.id}, ${organization.name}, ${sql.timestamp(organization.createdAt)},
                ${sql.timestamp(organization.updatedAt)}, ${timestampOrNull(organization.deletedAt)})
      `);
    });
  }

  public async updateOne(
    organization: OrganizationRoot,
  ): Promise<Result<void, OrganizationNotFound | PersistenceUnavailable>> {
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`
        UPDATE "organization".organizations SET
          name = ${organization.name},
          updated_at = ${sql.timestamp(organization.updatedAt)},
          deleted_at = ${timestampOrNull(organization.deletedAt)}
        WHERE id = ${organization.id}
      `),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0
      ? Err(new OrganizationNotFound({ organizationId: organization.id }))
      : Ok(undefined);
  }

  public findOne(
    spec: Specification<OrganizationRoot>,
  ): Promise<Result<OrganizationRoot | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.OrganizationRow)`
        SELECT * FROM "organization".organizations
        WHERE ${criteriaToWhere(spec.criteria, OrganizationMapper.columns)}
        LIMIT 1
      `);
      return row === null ? null : OrganizationMapper.toDomain(row);
    });
  }
}
