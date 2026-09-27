import { z } from "zod";

import { OrganizationId, TodoId } from "../EntityIds.js";
import { defineError, Forbidden, ServiceUnavailable } from "../HttpErrors.js";
import { defineGroup, defineRoute } from "../Route.js";

export const CliTodoNotFoundError = defineError(
  "CliTodoNotFoundError",
  404,
  { message: z.string() },
  "No todo with that id in this organization",
);

export const CliTodo = z
  .object({ id: TodoId, title: z.string(), completed: z.boolean() })
  .meta({ id: "CliTodo" });
export type CliTodo = z.infer<typeof CliTodo>;

export const CliCreateTodoPayload = z
  .object({ title: z.string().trim().min(1) })
  .meta({ id: "CliCreateTodoPayload" });
export type CliCreateTodoPayload = z.infer<typeof CliCreateTodoPayload>;

const OrgParams = z.object({ orgId: OrganizationId });
const OrgTodoParams = z.object({ orgId: OrganizationId, id: TodoId });

export const Group = defineGroup({
  name: "cliTodos",
  routes: {
    list: defineRoute({
      method: "get",
      path: "/cli/orgs/{orgId}/todos",
      operationId: "cliTodos.list",
      params: OrgParams,
      success: { status: 200, schema: z.array(CliTodo) },
      errors: [Forbidden, ServiceUnavailable],
      security: "session",
    }),
    create: defineRoute({
      method: "post",
      path: "/cli/orgs/{orgId}/todos",
      operationId: "cliTodos.create",
      params: OrgParams,
      body: CliCreateTodoPayload,
      success: { status: 201, schema: CliTodo },
      errors: [Forbidden, ServiceUnavailable],
      security: "session",
    }),
    complete: defineRoute({
      method: "post",
      path: "/cli/orgs/{orgId}/todos/{id}/complete",
      operationId: "cliTodos.complete",
      params: OrgTodoParams,
      success: { status: 200, schema: CliTodo },
      errors: [Forbidden, CliTodoNotFoundError, ServiceUnavailable],
      security: "session",
    }),
    remove: defineRoute({
      method: "delete",
      path: "/cli/orgs/{orgId}/todos/{id}",
      operationId: "cliTodos.remove",
      params: OrgTodoParams,
      success: { status: 204, schema: undefined },
      errors: [Forbidden, CliTodoNotFoundError, ServiceUnavailable],
      security: "session",
    }),
  },
});
