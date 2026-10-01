import type { RowSchemas } from "@org/database";

import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { TodoRoot } from "@/modules/todos/domain/todo/todo.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = {
  id: "id",
  organizationId: "organization_id",
} as const satisfies Partial<Record<keyof TodoRoot, string>> & ColumnMap;

export const toDomain = (row: RowSchemas.TodoRow): TodoRoot =>
  TodoRoot.parse({
    id: TodoId.parse(row.id),
    organizationId: OrganizationId.parse(row.organization_id),
    title: row.title,
    completed: row.completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export type PersistenceRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly title: string;
  readonly completed: boolean;
  readonly created_at: Date;
  readonly updated_at: Date;
};

export const toPersistence = (todo: TodoRoot): PersistenceRow => ({
  id: todo.id,
  organization_id: todo.organizationId,
  title: todo.title,
  completed: todo.completed,
  created_at: todo.createdAt,
  updated_at: todo.updatedAt,
});
