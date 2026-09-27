// ViewModel for the invite-a-teammate form. A non-admin's 403 is a
// notification, not a crash: the page stays put with what they typed.

import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";
import * as React from "react";

import { queryKeys } from "@/services/api/query-keys";
import { inviteUser } from "@/services/data-access/org-members.queries";
import { type FieldErrors, validateWithSchema } from "@/services/form-validation";
import { useApiMutation } from "@/services/query/use-api-mutation";

export type InviteFields = { readonly email: string };

export const EMPTY_FIELDS: InviteFields = { email: "" };

const validate = validateWithSchema(OrganizationContract.InviteUserPayload);

export type InviteFormViewModel = {
  readonly fields: InviteFields;
  readonly errors: FieldErrors<InviteFields> | null;
  readonly visibleErrors: FieldErrors<InviteFields> | null;
  readonly submitAttempted: boolean;
  readonly isSubmitting: boolean;
  readonly setEmail: (email: string) => void;
  readonly submit: () => void;
};

export const useInviteFormViewModel = (orgId: OrganizationId): InviteFormViewModel => {
  const [fields, setFields] = React.useState<InviteFields>(EMPTY_FIELDS);
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const errors = React.useMemo(() => validate(fields), [fields]);
  const visibleErrors = submitAttempted ? errors : null;

  const mutation = useApiMutation({
    mutationFn: (payload: OrganizationContract.InviteUserPayload) => inviteUser({ orgId, payload }),
    invalidates: [queryKeys.organizationInvitations.all],
    notify: {
      success: () => "Invitation sent.",
      errors: {
        OrganizationNotFoundError: (error) => error.message,
        Forbidden: (error) => error.message,
      },
    },
    onSuccess: () => {
      setFields(EMPTY_FIELDS);
      setSubmitAttempted(false);
    },
  });

  const setEmail = React.useCallback((email: string) => {
    setFields({ email });
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
    setEmail,
    submit,
  };
};
