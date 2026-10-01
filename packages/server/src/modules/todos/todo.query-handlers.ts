import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { FindTodoOrganizationHandler } from "./queries/find-todo-organization.handler.js";
import { FindTodoOrganizationQuery } from "./queries/find-todo-organization.query.js";
import { ListTodosHandler } from "./queries/list-todos.handler.js";
import { ListTodosQuery } from "./queries/list-todos.query.js";

export const todoQueries = [ListTodosQuery, FindTodoOrganizationQuery] as const;

export const todoQueryHandlers = [ListTodosHandler, FindTodoOrganizationHandler] as const;

export const todoQuerySpanAttributes: MessageSpanAttributes = {
  ListTodosQuery: ({ payload }: ListTodosQuery) => ({ "organization.id": payload.organizationId }),
  FindTodoOrganizationQuery: ({ payload }: FindTodoOrganizationQuery) => ({
    "query.organizationId": payload.organizationId,
    "query.todoId": payload.todoId,
  }),
};
