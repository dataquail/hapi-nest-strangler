"use client";

import { EmptyState } from "@org/components/patterns/empty-state";
import { List } from "@org/components/primitives/list";
import type { OrganizationId } from "@org/contracts/EntityIds";

import { TodoItem } from "./todo-item/todo-item.view";
import { useTodoListViewModel } from "./todo-list.view-model";

export const TodoList: React.FC<{ readonly orgId: OrganizationId }> = ({ orgId }) => {
  const { isEmpty, todos } = useTodoListViewModel(orgId);

  if (isEmpty) {
    return <EmptyState message="No tasks yet. Add one above!" />;
  }

  return (
    <List gap="sm" data-testid="todo-list">
      {todos.map((todo) => (
        <List.Item key={todo.id}>
          <TodoItem todo={todo} orgId={orgId} />
        </List.Item>
      ))}
    </List>
  );
};
