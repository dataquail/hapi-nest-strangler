import type { RowSchemas } from "@org/database";

import { OrganizationRoleValueObject } from "@/modules/organization/domain/organization-roles/organization-role.value-object.js";
import { OrganizationRolesRoot } from "@/modules/organization/domain/organization-roles/organization-roles.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = {
  userId: "user_id",
  organizationId: "organization_id",
} as const satisfies Partial<Record<keyof OrganizationRolesRoot, string>> & ColumnMap;

// One aggregate spans many rows; an empty set reads as absent so the use case
// starts from `empty()`.
export const toDomain = (
  rows: ReadonlyArray<RowSchemas.OrganizationRoleRow>,
): OrganizationRolesRoot | null => {
  const first = rows[0];
  if (first === undefined) return null;
  return OrganizationRolesRoot.parse({
    userId: UserId.parse(first.user_id),
    organizationId: OrganizationId.parse(first.organization_id),
    roles: rows.map((row) => ({
      role: OrganizationRoleValueObject.parse(row.role),
      issuedBy: UserId.parse(row.issued_by),
    })),
  });
};
