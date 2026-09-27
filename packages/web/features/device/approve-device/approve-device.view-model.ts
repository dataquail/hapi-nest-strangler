// ViewModel for CLI device approval. The code arrives in the URL (`?code=`)
// and seeds the field once. The success state is durable: once approved, the
// page swaps to a "return to your terminal" confirmation that outlives the toast.

import { AuthContract } from "@org/contracts/api/Contracts";
import * as React from "react";

import { approveDevice } from "@/services/data-access/device.queries";
import { type FieldErrors, validateWithSchema } from "@/services/form-validation";
import { useApiMutation } from "@/services/query/use-api-mutation";

export type ApproveDeviceFields = { readonly userCode: string };

const validate = validateWithSchema(AuthContract.DeviceApprovalPayload);

export type ApproveDeviceViewModel = {
  readonly fields: ApproveDeviceFields;
  readonly errors: FieldErrors<ApproveDeviceFields> | null;
  readonly visibleErrors: FieldErrors<ApproveDeviceFields> | null;
  readonly submitAttempted: boolean;
  readonly isSubmitting: boolean;
  readonly isApproved: boolean;
  readonly setUserCode: (userCode: string) => void;
  readonly submit: () => void;
};

export const useApproveDeviceViewModel = (initialCode: string): ApproveDeviceViewModel => {
  const [fields, setFields] = React.useState<ApproveDeviceFields>({ userCode: initialCode });
  const [submitAttempted, setSubmitAttempted] = React.useState(false);
  const errors = React.useMemo(() => validate(fields), [fields]);
  const visibleErrors = submitAttempted ? errors : null;

  const mutation = useApiMutation({
    mutationFn: (payload: AuthContract.DeviceApprovalPayload) => approveDevice(payload),
    notify: {
      success: () => "Device approved — return to your terminal.",
      errors: { NotFound: (error) => error.message, Gone: (error) => error.message },
    },
  });

  const setUserCode = React.useCallback((userCode: string) => {
    setFields({ userCode });
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
    isApproved: mutation.isSuccess,
    setUserCode,
    submit,
  };
};
