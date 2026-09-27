import type { RowSchemas } from "@org/database";

import { RoleValueObject } from "@/modules/role/domain/roles/role.value-object.js";
import { RolesRoot } from "@/modules/role/domain/roles/roles.root.js";
import { UserId } from "@/platform/ids/user-id.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = {
  userId: "user_id",
} as const satisfies Partial<Record<keyof RolesRoot, string>> & ColumnMap;

// One aggregate spans many rows: the user's roles are reconstituted from every
// platform.roles row for that user.
export const toDomain = (
  userId: string,
  rows: ReadonlyArray<RowSchemas.PlatformRoleRow>,
): RolesRoot =>
  RolesRoot.parse({
    userId: UserId.parse(userId),
    roles: rows.map((row) => RoleValueObject.parse(row.role)),
  });
