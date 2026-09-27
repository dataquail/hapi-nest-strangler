import type { RowSchemas } from "@org/database";

import { InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = {
  id: "id",
  organizationId: "organization_id",
  inviteeEmail: "invitee_email",
  token: "token",
  acceptedAt: "accepted_at",
  revokedAt: "revoked_at",
} as const satisfies Partial<Record<keyof InvitationRoot, string>> & ColumnMap;

export const toDomain = (row: RowSchemas.InvitationRow): InvitationRoot =>
  InvitationRoot.parse({
    id: InvitationId.parse(row.id),
    organizationId: OrganizationId.parse(row.organization_id),
    inviteeEmail: row.invitee_email,
    token: row.token,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  });
