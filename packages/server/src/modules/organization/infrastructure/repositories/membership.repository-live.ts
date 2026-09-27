import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import { Err, Ok, type Result } from "oxide.ts";

import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.js";
import type { MembershipRoot } from "@/modules/organization/domain/membership/membership.root.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as MembershipMapper from "./membership.mapper.js";

@Injectable()
export class MembershipRepositoryLive extends MembershipRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  public insertOne(membership: MembershipRoot): Promise<Result<void, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      await this.db.exec(sql.unsafe`
        INSERT INTO "organization".memberships (user_id, organization_id, created_at)
        VALUES (${membership.userId}, ${membership.organizationId}, ${sql.timestamp(membership.createdAt)})
        ON CONFLICT (user_id, organization_id) DO NOTHING
      `);
    });
  }

  public async deleteOne(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<Result<void, MembershipNotFound | PersistenceUnavailable>> {
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`
        DELETE FROM "organization".memberships
        WHERE user_id = ${userId} AND organization_id = ${organizationId}
      `),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0
      ? Err(new MembershipNotFound({ userId, organizationId }))
      : Ok(undefined);
  }

  public findOne(
    spec: Specification<MembershipRoot>,
  ): Promise<Result<MembershipRoot | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.MembershipRow)`
        SELECT * FROM "organization".memberships
        WHERE ${criteriaToWhere(spec.criteria, MembershipMapper.columns)}
        LIMIT 1
      `);
      return row === null ? null : MembershipMapper.toDomain(row);
    });
  }
}
