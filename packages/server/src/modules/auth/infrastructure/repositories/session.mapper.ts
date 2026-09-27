import type { RowSchemas } from "@org/database";

import { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { SessionRoot } from "@/modules/auth/domain/session/session.root.js";
import { UserId } from "@/platform/ids/user-id.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = { id: "id" } as const satisfies Partial<Record<keyof SessionRoot, string>> &
  ColumnMap;

export const toDomain = (row: RowSchemas.SessionRow): SessionRoot =>
  SessionRoot.parse({
    id: SessionId.parse(row.id),
    userId: UserId.parse(row.user_id),
    subject: row.subject,
    expiresAt: row.expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  });
