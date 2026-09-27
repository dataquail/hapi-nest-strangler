import { z } from "zod";

import { OrganizationId, TodoId } from "../EntityIds.js";
import { defineError, Forbidden, ServiceUnavailable } from "../HttpErrors.js";
import { defineGroup, defineRoute } from "../Route.js";

export const TodoNotFoundError = defineError(
  "TodoNotFoundError",
  404,
  { message: z.string() },
  "No todo with that id in this organization",
);

export const Todo = z
  .object({
    id: TodoId,
    title: z.string().trim().min(1),
    completed: z.boolean(),
  })
  .meta({ id: "Todo" });
export type Todo = z.infer<typeof Todo>;

export const CreateTodoPayload = z
  .object({ title: Todo.shape.title })
  .meta({ id: "CreateTodoPayload" });
export type CreateTodoPayload = z.infer<typeof CreateTodoPayload>;

export const UpdateTodoPayload = z
  .object({ title: Todo.shape.title, completed: Todo.shape.completed })
  .meta({ id: "UpdateTodoPayload" });
export type UpdateTodoPayload = z.infer<typeof UpdateTodoPayload>;

const OrgParams = z.object({ orgId: OrganizationId });
const OrgTodoParams = z.object({ orgId: OrganizationId, id: TodoId });

// Todos are org-scoped: every endpoint carries the owning org in the path and
// is gated by org membership — a non-member gets 403.
export const Group = defineGroup({
  name: "todos",
  routes: {
    get: defineRoute({
      method: "get",
      path: "/orgs/{orgId}/todos",
      operationId: "todos.get",
      params: OrgParams,
      success: { status: 200, schema: z.array(Todo) },
      errors: [Forbidden, ServiceUnavailable],
      security: "session",
    }),
    create: defineRoute({
      method: "post",
      path: "/orgs/{orgId}/todos",
      operationId: "todos.create",
      params: OrgParams,
      body: CreateTodoPayload,
      success: { status: 201, schema: Todo },
      errors: [Forbidden, ServiceUnavailable],
      security: "session",
    }),
    update: defineRoute({
      method: "put",
      path: "/orgs/{orgId}/todos/{id}",
      operationId: "todos.update",
      params: OrgTodoParams,
      body: UpdateTodoPayload,
      success: { status: 200, schema: Todo },
      errors: [Forbidden, TodoNotFoundError, ServiceUnavailable],
      security: "session",
    }),
    delete: defineRoute({
      method: "delete",
      path: "/orgs/{orgId}/todos/{id}",
      operationId: "todos.delete",
      params: OrgTodoParams,
      success: { status: 204, schema: undefined },
      errors: [Forbidden, TodoNotFoundError, ServiceUnavailable],
      security: "session",
    }),
  },
});
