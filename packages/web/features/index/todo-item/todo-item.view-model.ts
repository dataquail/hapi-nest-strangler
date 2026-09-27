// ViewModel for a single todo row: the two writes it can make and what each
// announces. The todo is passed in rather than looked up: the row renders from
// the list's already-fetched page.

import type { OrganizationId } from "@org/contracts/EntityIds";

import { queryKeys } from "@/services/api/query-keys";
import type { Schemas } from "@/services/api/types";
import { deleteTodo, updateTodo } from "@/services/data-access/todos.queries";
import { useApiMutation } from "@/services/query/use-api-mutation";

export type TodoItemViewModel = {
  readonly toggle: () => void;
  readonly remove: () => void;
  readonly isToggling: boolean;
  readonly isRemoving: boolean;
};

const NOT_FOUND = { TodoNotFoundError: (error: { readonly message: string }) => error.message };

export const useTodoItemViewModel = (
  orgId: OrganizationId,
  todo: Schemas["Todo"],
): TodoItemViewModel => {
  const toggle = useApiMutation({
    mutationFn: () =>
      updateTodo({
        orgId,
        id: todo.id as Parameters<typeof updateTodo>[0]["id"],
        payload: { title: todo.title, completed: !todo.completed },
      }),
    invalidates: [queryKeys.todos.all],
    notify: { success: () => "Todo updated!", errors: NOT_FOUND },
  });
  const remove = useApiMutation({
    mutationFn: () => deleteTodo({ orgId, id: todo.id as Parameters<typeof deleteTodo>[0]["id"] }),
    invalidates: [queryKeys.todos.all],
    notify: { success: () => "Todo deleted!", errors: NOT_FOUND },
  });
  return {
    toggle: () => {
      toggle.mutate(undefined);
    },
    remove: () => {
      remove.mutate(undefined);
    },
    isToggling: toggle.isPending,
    isRemoving: remove.isPending,
  };
};
