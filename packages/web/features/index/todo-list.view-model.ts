// ViewModel for the todo list. Todos are org-scoped, so the query is keyed by
// the org: two orgs are two cache entries, not one that has to be told which
// org it is showing.

import type { OrganizationId } from "@org/contracts/EntityIds";
import { useSuspenseQuery } from "@tanstack/react-query";

import type { Schemas } from "@/services/api/types";
import { todosQuery } from "@/services/data-access/todos.queries";

export type TodoListViewModel = {
  readonly todos: ReadonlyArray<Schemas["Todo"]>;
  readonly isEmpty: boolean;
};

export const useTodoListViewModel = (orgId: OrganizationId): TodoListViewModel => {
  const { data: todos } = useSuspenseQuery(todosQuery(orgId));
  return { todos, isEmpty: todos.length === 0 };
};
