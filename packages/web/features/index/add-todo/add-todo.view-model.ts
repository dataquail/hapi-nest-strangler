// ViewModel for the add-todo form: one field, the same shape as every other
// form here. Fields as state, validation derived, and a submit that guards
// before it announces anything.

import { TodosContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";
import * as React from "react";

import { queryKeys } from "@/services/api/query-keys";
import { createTodo } from "@/services/data-access/todos.queries";
import { type FieldErrors, validateWithSchema } from "@/services/form-validation";
import { useApiMutation } from "@/services/query/use-api-mutation";

export type AddTodoFields = { readonly title: string };

export const EMPTY_FIELDS: AddTodoFields = { title: "" };

const validate = validateWithSchema(TodosContract.CreateTodoPayload);

export type AddTodoViewModel = {
  readonly fields: AddTodoFields;
  readonly errors: FieldErrors<AddTodoFields> | null;
  readonly visibleErrors: FieldErrors<AddTodoFields> | null;
  readonly submitAttempted: boolean;
  readonly isSubmitting: boolean;
  readonly setTitle: (title: string) => void;
  readonly submit: () => void;
};

export const useAddTodoViewModel = (orgId: OrganizationId): AddTodoViewModel => {
  const [fields, setFields] = React.useState<AddTodoFields>(EMPTY_FIELDS);
  // Validation runs continuously but only surfaces after the first attempt: an
  // empty form should not greet you with an error.
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const errors = React.useMemo(() => validate(fields), [fields]);
  const visibleErrors = submitAttempted ? errors : null;

  const mutation = useApiMutation({
    mutationFn: (payload: TodosContract.CreateTodoPayload) => createTodo({ orgId, payload }),
    invalidates: [queryKeys.todos.all],
    notify: { success: () => "Todo created!" },
    onSuccess: () => {
      setFields(EMPTY_FIELDS);
      setSubmitAttempted(false);
    },
  });

  const setTitle = React.useCallback((title: string) => {
    setFields({ title });
  }, []);

  // The guard stays in front of the mutation: an invalid submit never calls
  // the API and never announces anything.
  const submit = React.useCallback(() => {
    setSubmitAttempted(true);
    if (validate(fields) !== null) return;
    mutation.mutate(fields);
  }, [fields, mutation]);

  return {
    fields,
    errors,
    visibleErrors,
    submitAttempted,
    isSubmitting: mutation.isPending,
    setTitle,
    submit,
  };
};
