// ViewModel for the create-organization form. On success it navigates into the
// new org, so the user is not left picking it back out of the switcher.

import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as React from "react";

import { queryKeys } from "@/services/api/query-keys";
import { createOrg } from "@/services/data-access/orgs.queries";
import { type FieldErrors, validateWithSchema } from "@/services/form-validation";
import { navigateTo } from "@/services/navigation.shared";
import { useApiMutation } from "@/services/query/use-api-mutation";

export type CreateOrgFields = { readonly name: string };

export const EMPTY_FIELDS: CreateOrgFields = { name: "" };

const validate = validateWithSchema(OrganizationContract.CreateOrganizationPayload);

export type CreateOrgViewModel = {
  readonly fields: CreateOrgFields;
  readonly errors: FieldErrors<CreateOrgFields> | null;
  readonly visibleErrors: FieldErrors<CreateOrgFields> | null;
  readonly submitAttempted: boolean;
  readonly isSubmitting: boolean;
  readonly setName: (name: string) => void;
  readonly submit: () => void;
};

export const useCreateOrgViewModel = (): CreateOrgViewModel => {
  const [fields, setFields] = React.useState<CreateOrgFields>(EMPTY_FIELDS);
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const errors = React.useMemo(() => validate(fields), [fields]);
  const visibleErrors = submitAttempted ? errors : null;

  const mutation = useApiMutation({
    mutationFn: (payload: OrganizationContract.CreateOrganizationPayload) => createOrg(payload),
    invalidates: [queryKeys.organizations.all],
    notify: { success: () => "Organization created!" },
    onSuccess: (created) => {
      setFields(EMPTY_FIELDS);
      setSubmitAttempted(false);
      navigateTo(`/orgs/${created.id}`);
    },
  });

  const setName = React.useCallback((name: string) => {
    setFields({ name });
  }, []);

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
    setName,
    submit,
  };
};
