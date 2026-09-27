import type { RowSchemas } from "@org/database";

import type { AuthIdentity } from "@/modules/auth/domain/auth-identity/auth-identity.repository.js";
import { UserId } from "@/platform/ids/user-id.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = { subject: "subject" } as const satisfies Partial<
  Record<keyof AuthIdentity, string>
> &
  ColumnMap;

export const toDomain = (row: RowSchemas.AuthIdentityRow): AuthIdentity => ({
  subject: row.subject,
  userId: UserId.parse(row.user_id),
  provider: row.provider,
});
