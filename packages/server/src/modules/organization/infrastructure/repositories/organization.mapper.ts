import type { RowSchemas } from "@org/database";

import { OrganizationRoot } from "@/modules/organization/domain/organization/organization.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = {
  id: "id",
  deletedAt: "deleted_at",
} as const satisfies Partial<Record<keyof OrganizationRoot, string>> & ColumnMap;

export const toDomain = (row: RowSchemas.OrganizationRow): OrganizationRoot =>
  OrganizationRoot.parse({
    id: OrganizationId.parse(row.id),
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });
