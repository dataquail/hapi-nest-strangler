// A mutation as a ViewModel names it: what it calls, which query roots it
// dirties, and what it announces. Errors are announced by tag, so a ViewModel
// states the messages and nothing else.

import { type MutationKey, useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { isApiError } from "../api/api-error";
import type { InvalidationKey } from "../api/query-keys";
import { type NotifyConfig, notifyFailure, notifySuccess } from "../notifications.shared";

export type ApiMutationOptions<Input, Output> = {
  readonly mutationKey?: MutationKey;
  readonly mutationFn: (input: Input) => Promise<Output>;
  readonly invalidates?: ReadonlyArray<InvalidationKey>;
  readonly notify?: NotifyConfig<Output>;
  readonly onSuccess?: (output: Output, input: Input) => void;
};

export type ApiMutation<Input, Output> = {
  readonly mutate: (input: Input) => void;
  readonly mutateAsync: (input: Input) => Promise<Output>;
  readonly isPending: boolean;
  readonly isSuccess: boolean;
  readonly isError: boolean;
  readonly error: unknown;
};

export const useApiMutation = <Input, Output>(
  options: ApiMutationOptions<Input, Output>,
): ApiMutation<Input, Output> => {
  const queryClient = useQueryClient();
  const mutation = useMutation<Output, Error, Input>({
    ...(options.mutationKey === undefined ? {} : { mutationKey: options.mutationKey }),
    mutationFn: options.mutationFn,
    onSuccess: async (output, input) => {
      if (options.notify !== undefined) notifySuccess(options.notify, output);
      options.onSuccess?.(output, input);
      await Promise.all(
        (options.invalidates ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
    onError: (error) => {
      if (options.notify !== undefined) notifyFailure(options.notify, error);
    },
  });

  // A failed mutation is announced, never rethrown into the caller: a screen
  // reacts to the notification, not to a rejected promise.
  const mutateAsync = React.useCallback(
    (input: Input) => mutation.mutateAsync(input).catch((error: unknown) => Promise.reject(error)),
    [mutation],
  );

  return {
    mutate: mutation.mutate,
    mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: isApiError(mutation.error) ? mutation.error : mutation.error,
  };
};
