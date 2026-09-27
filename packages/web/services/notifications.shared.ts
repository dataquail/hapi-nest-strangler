// Notifications as state rather than an injected service. A ViewModel pushes
// into a tiny store, one bridge at the edge of the app turns it into sonner,
// and a test reads the store back.

import { isApiError } from "./api/api-error";
import { makeStore } from "./store.shared";

export type NotificationKind = "success" | "error";

export type Notification = {
  // Two identical messages in a row are two notifications; the sequence is what
  // makes the second one observable.
  readonly seq: number;
  readonly kind: NotificationKind;
  readonly message: string;
};

export const notificationStore = makeStore<Notification | null>(null);

export const pushNotification = (input: {
  readonly kind: NotificationKind;
  readonly message: string;
}): void => {
  const previous = notificationStore.get();
  notificationStore.set({
    seq: (previous?.seq ?? 0) + 1,
    kind: input.kind,
    message: input.message,
  });
};

const DEFAULT_ERROR_MESSAGE = "Something went wrong";

export type NotifyConfig<A> = {
  readonly success?: (value: A) => string;
  readonly errors?: Readonly<Record<string, (error: { readonly message: string }) => string>>;
  readonly otherwise?: string;
};

export const notifySuccess = <A>(config: NotifyConfig<A>, value: A): void => {
  if (config.success === undefined) return;
  pushNotification({ kind: "success", message: config.success(value) });
};

export const notifyFailure = <A>(config: NotifyConfig<A>, error: unknown): void => {
  const handler = isApiError(error) ? config.errors?.[error._tag] : undefined;
  const message =
    handler !== undefined && isApiError(error)
      ? handler({ message: error.message })
      : (config.otherwise ?? DEFAULT_ERROR_MESSAGE);
  pushNotification({ kind: "error", message });
};
