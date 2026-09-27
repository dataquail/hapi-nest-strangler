"use client";

import { Button } from "@org/components/primitives/button";
import { Form } from "@org/components/primitives/form";
import { PlusIcon } from "@org/components/primitives/icon";
import { Input } from "@org/components/primitives/input";
import { Spinner } from "@org/components/primitives/spinner";
import { Stack } from "@org/components/primitives/stack";
import { Text } from "@org/components/primitives/text";
import type { OrganizationId } from "@org/contracts/EntityIds";

import { useAddTodoViewModel } from "./add-todo.view-model";

export const AddTodo: React.FC<{ readonly orgId: OrganizationId }> = ({ orgId }) => {
  const { fields, isSubmitting, setTitle, submit, visibleErrors } = useAddTodoViewModel(orgId);

  return (
    <Form onSubmit={submit}>
      <Stack direction="row" gap="sm" align="start">
        <Stack direction="column" grow shrinkBelowContent>
          <Form.Control>
            <Input
              type="text"
              id="add-todo-title"
              value={fields.title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              placeholder="Add a new task..."
              data-testid="add-todo-input"
            />
            <Form.Error error={visibleErrors?.title} />
          </Form.Control>
        </Stack>

        <Button type="submit" size="icon" disabled={isSubmitting} data-testid="add-todo-submit">
          {isSubmitting ? <Spinner size="sm" tone="inherit" /> : <PlusIcon size="lg" />}
          <Text as="span" srOnly>
            Add task
          </Text>
        </Button>
      </Stack>
    </Form>
  );
};
