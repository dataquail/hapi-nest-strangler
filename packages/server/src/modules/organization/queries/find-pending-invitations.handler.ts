import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { RowSchemas, sql } from "@org/database";

import { Database } from "@/platform/database/database.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import {
  FindPendingInvitationsQuery,
  type FindPendingInvitationsResult,
  type PendingInvitationView,
} from "./find-pending-invitations.query.js";

const toView = (row: RowSchemas.InvitationRow, now: Date): PendingInvitationView => ({
  invitationId: InvitationId.parse(row.id),
  inviteeEmail: row.invitee_email,
  status: row.expires_at.getTime() <= now.getTime() ? "expired" : "pending",
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

@QueryHandler(FindPendingInvitationsQuery)
export class FindPendingInvitationsHandler implements IQueryHandler<FindPendingInvitationsQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({ payload }: FindPendingInvitationsQuery): Promise<FindPendingInvitationsResult> {
    const now = new Date();
    return translateDatabaseErrors(async () => {
      const rows = await this.db.any(sql.type(RowSchemas.InvitationRow)`
        SELECT * FROM "organization".invitations
        WHERE organization_id = ${payload.organizationId}
          AND accepted_at IS NULL
          AND revoked_at IS NULL
        ORDER BY created_at DESC
      `);
      return rows.map((row) => toView(row, now));
    });
  }
}
