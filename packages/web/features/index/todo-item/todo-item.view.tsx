"use client";

import { ListRow } from "@org/components/patterns/list-row";
import { Button } from "@org/components/primitives/button";
import { Checkbox } from "@org/components/primitives/checkbox";
import { TrashIcon } from "@org/components/primitives/icon";
import { Label } from "@org/components/primitives/label";
import { Text } from "@org/components/primitives/text";
import type { OrganizationId } from "@org/contracts/EntityIds";

import type { Schemas } from "@/services/api/types";

import { useTodoItemViewModel } from "./todo-item.view-model";

export const TodoItem: React.FC<{
  readonly todo: Schemas["Todo"];
  readonly orgId: OrganizationId;
}> = ({ orgId, todo }) => {
  const { remove, toggle } = useTodoItemViewModel(orgId, todo);
  const checkboxId = `todo-${todo.id}`;

  return (
    <ListRow
      data-testid="todo-item"
      revealTrailing
      leading={<Checkbox id={checkboxId} checked={todo.completed} onCheckedChange={toggle} />}
      trailing={
        <Button variant="ghost" size="icon" onClick={remove} data-testid="todo-item-delete">
          <TrashIcon tone="destructive" />
          <Text as="span" srOnly>
            Delete
          </Text>
        </Button>
      }
    >
      <Label
        htmlFor={checkboxId}
        truncate
        tone={todo.completed ? "muted" : "default"}
        decoration={todo.completed ? "line-through" : "none"}
      >
        {todo.title}
      </Label>
    </ListRow>
  );
};
