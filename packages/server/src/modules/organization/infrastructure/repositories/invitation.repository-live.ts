import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import { Err, Ok, type Result } from "oxide.ts";

import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import type { InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as InvitationMapper from "./invitation.mapper.js";

const timestampOrNull = (value: Date | null) => (value === null ? null : sql.timestamp(value));

@Injectable()
export class InvitationRepositoryLive extends InvitationRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  public insertOne(invitation: InvitationRoot): Promise<Result<void, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      await this.db.exec(sql.unsafe`
        INSERT INTO "organization".invitations
          (id, organization_id, invitee_email, token, expires_at, accepted_at, revoked_at, created_at)
        VALUES (${invitation.id}, ${invitation.organizationId}, ${invitation.inviteeEmail}, ${invitation.token},
                ${sql.timestamp(invitation.expiresAt)}, ${timestampOrNull(invitation.acceptedAt)},
                ${timestampOrNull(invitation.revokedAt)}, ${sql.timestamp(invitation.createdAt)})
      `);
    });
  }

  public async updateOne(
    invitation: InvitationRoot,
  ): Promise<Result<void, InvitationNotFound | PersistenceUnavailable>> {
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`
        UPDATE "organization".invitations SET
          token = ${invitation.token},
          expires_at = ${sql.timestamp(invitation.expiresAt)},
          accepted_at = ${timestampOrNull(invitation.acceptedAt)},
          revoked_at = ${timestampOrNull(invitation.revokedAt)}
        WHERE id = ${invitation.id}
      `),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0
      ? Err(new InvitationNotFound({ invitationId: invitation.id }))
      : Ok(undefined);
  }

  public findOne(
    spec: Specification<InvitationRoot>,
  ): Promise<Result<InvitationRoot | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.InvitationRow)`
        SELECT * FROM "organization".invitations
        WHERE ${criteriaToWhere(spec.criteria, InvitationMapper.columns)}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      return row === null ? null : InvitationMapper.toDomain(row);
    });
  }

  public findMany(
    spec: Specification<InvitationRoot>,
  ): Promise<Result<ReadonlyArray<InvitationRoot>, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const rows = await this.db.any(sql.type(RowSchemas.InvitationRow)`
        SELECT * FROM "organization".invitations
        WHERE ${criteriaToWhere(spec.criteria, InvitationMapper.columns)}
        ORDER BY created_at DESC
      `);
      return rows.map(InvitationMapper.toDomain);
    });
  }
}
