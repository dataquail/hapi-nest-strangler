// ViewModel for the create-user form: field state, validation, submission and
// the notification policy, as a hook over React state and TanStack Query.

import { UserContract } from "@org/contracts/api/Contracts";
import * as React from "react";

import { queryKeys } from "@/services/api/query-keys";
import { createUser } from "@/services/data-access/users.queries";
import { type FieldErrors, validateWithSchema } from "@/services/form-validation";
import { useApiMutation } from "@/services/query/use-api-mutation";

export type CreateUserFields = {
  readonly email: string;
  readonly country: string;
  readonly street: string;
  readonly postalCode: string;
};

export type CreateUserField = keyof CreateUserFields;

export const EMPTY_FIELDS: CreateUserFields = {
  email: "",
  country: "",
  street: "",
  postalCode: "",
};

const validate = validateWithSchema(UserContract.CreateUserPayload);

export type CreateUserViewModel = {
  readonly fields: CreateUserFields;
  readonly errors: FieldErrors<CreateUserFields> | null;
  readonly visibleErrors: FieldErrors<CreateUserFields> | null;
  readonly submitAttempted: boolean;
  readonly isSubmitting: boolean;
  readonly setField: (field: CreateUserField, value: string) => void;
  readonly setFields: (fields: CreateUserFields) => void;
  readonly submit: () => void;
};

export const useCreateUserViewModel = (
  initial: CreateUserFields = EMPTY_FIELDS,
): CreateUserViewModel => {
  const [fields, setFields] = React.useState<CreateUserFields>(initial);
  // Validation runs continuously, but only surfaces once the user has tried to
  // submit: an empty form should not greet you with four errors.
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const errors = React.useMemo(() => validate(fields), [fields]);
  const visibleErrors = submitAttempted ? errors : null;

  const mutation = useApiMutation({
    mutationFn: (payload: UserContract.CreateUserPayload) => createUser(payload),
    invalidates: [queryKeys.users.all],
    notify: {
      success: () => "User created!",
      errors: { UserAlreadyExistsError: (error) => error.message },
    },
    onSuccess: () => {
      setFields(EMPTY_FIELDS);
      setSubmitAttempted(false);
    },
  });

  const setField = React.useCallback((field: CreateUserField, value: string) => {
    setFields((previous) => ({ ...previous, [field]: value }));
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
    setField,
    setFields,
    submit,
  };
};
