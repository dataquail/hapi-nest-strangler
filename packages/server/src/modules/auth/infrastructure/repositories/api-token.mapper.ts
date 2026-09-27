import type { RowSchemas } from "@org/database";

import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id.js";
import { ApiTokenRoot } from "@/modules/auth/domain/api-token/api-token.root.js";
import { UserId } from "@/platform/ids/user-id.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = {
  id: "id",
  userId: "user_id",
  tokenHash: "token_hash",
  revokedAt: "revoked_at",
} as const satisfies Partial<Record<keyof ApiTokenRoot, string>> & ColumnMap;

export const toDomain = (row: RowSchemas.ApiTokenRow): ApiTokenRoot =>
  ApiTokenRoot.parse({
    id: ApiTokenId.parse(row.id),
    userId: UserId.parse(row.user_id),
    tokenHash: row.token_hash,
    prefix: row.prefix,
    label: row.label,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  });
