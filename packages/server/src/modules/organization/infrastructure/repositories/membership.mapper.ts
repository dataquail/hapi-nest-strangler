import type { RowSchemas } from "@org/database";

import { MembershipRoot } from "@/modules/organization/domain/membership/membership.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = {
  userId: "user_id",
  organizationId: "organization_id",
} as const satisfies Partial<Record<keyof MembershipRoot, string>> & ColumnMap;

export const toDomain = (row: RowSchemas.MembershipRow): MembershipRoot =>
  MembershipRoot.parse({
    userId: UserId.parse(row.user_id),
    organizationId: OrganizationId.parse(row.organization_id),
    createdAt: row.created_at,
  });
