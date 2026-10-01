import { z } from "zod";

import { OrganizationId, TodoId } from "../EntityIds.js";
import { defineError, ServiceUnavailable } from "../HttpErrors.js";
import { defineGroup, defineRoute } from "../Route.js";

export const InternalTodoNotFoundError = defineError(
  "InternalTodoNotFoundError",
  404,
  { message: z.string() },
  "No todo with that id in this organization has been mirrored to this server",
);

export const InternalTodoAlreadyExistsError = defineError(
  "InternalTodoAlreadyExistsError",
  409,
  { message: z.string() },
  "A todo with that id has already been mirrored to this server",
);

export const InternalTodo = z
  .object({
    id: TodoId,
    organizationId: OrganizationId,
    title: z.string(),
    completed: z.boolean(),
  })
  .meta({ id: "InternalTodo" });
export type InternalTodo = z.infer<typeof InternalTodo>;

export const InternalCreateTodoPayload = z
  .object({ id: TodoId, title: z.string().trim().min(1) })
  .meta({ id: "InternalCreateTodoPayload" });
export type InternalCreateTodoPayload = z.infer<typeof InternalCreateTodoPayload>;

export const InternalUpdateTodoPayload = z
  .object({ title: z.string().trim().min(1), completed: z.boolean() })
  .meta({ id: "InternalUpdateTodoPayload" });
export type InternalUpdateTodoPayload = z.infer<typeof InternalUpdateTodoPayload>;

const OrgParams = z.object({ organizationId: OrganizationId });
const OrgTodoParams = z.object({ organizationId: OrganizationId, id: TodoId });

// Service-to-service only: while the legacy API owns todos it mirrors every
// write here, carrying its own ids so the replica can take over without
// renumbering anything a client holds. No user travels with these calls.
export const Group = defineGroup({
  name: "internal-todos",
  routes: {
    create: defineRoute({
      method: "post",
      path: "/internal/orgs/{organizationId}/todos",
      operationId: "internalTodos.create",
      params: OrgParams,
      body: InternalCreateTodoPayload,
      success: { status: 201, schema: InternalTodo },
      errors: [InternalTodoAlreadyExistsError, ServiceUnavailable],
      security: "service",
    }),
    update: defineRoute({
      method: "put",
      path: "/internal/orgs/{organizationId}/todos/{id}",
      operationId: "internalTodos.update",
      params: OrgTodoParams,
      body: InternalUpdateTodoPayload,
      success: { status: 200, schema: InternalTodo },
      errors: [InternalTodoNotFoundError, ServiceUnavailable],
      security: "service",
    }),
    complete: defineRoute({
      method: "post",
      path: "/internal/orgs/{organizationId}/todos/{id}/complete",
      operationId: "internalTodos.complete",
      params: OrgTodoParams,
      success: { status: 200, schema: InternalTodo },
      errors: [InternalTodoNotFoundError, ServiceUnavailable],
      security: "service",
    }),
    delete: defineRoute({
      method: "delete",
      path: "/internal/orgs/{organizationId}/todos/{id}",
      operationId: "internalTodos.delete",
      params: OrgTodoParams,
      success: { status: 204, schema: undefined },
      errors: [InternalTodoNotFoundError, ServiceUnavailable],
      security: "service",
    }),
  },
});
