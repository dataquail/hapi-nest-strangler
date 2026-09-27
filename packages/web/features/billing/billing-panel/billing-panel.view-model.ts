// ViewModel for the org's billing panel. Stripe's status vocabulary arrives
// verbatim; the mapping to a badge and a label lives here, in one switch the
// test exercises exhaustively. An unknown status renders as its literal string
// rather than crashing.

import type { OrganizationId } from "@org/contracts/EntityIds";
import { useSuspenseQuery } from "@tanstack/react-query";
import * as React from "react";

import { queryKeys } from "@/services/api/query-keys";
import {
  cancelSubscription,
  type CurrentSubscription,
  startSubscription,
  subscriptionQuery,
} from "@/services/data-access/billing.queries";
import { formatDayOrNull } from "@/services/format/date.shared";
import { useApiMutation } from "@/services/query/use-api-mutation";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export type BillingPanelView = {
  readonly hasSubscription: boolean;
  readonly statusLabel: string;
  readonly statusVariant: BadgeVariant;
  readonly currentPeriodEndLabel: string | null;
  readonly canStart: boolean;
  readonly canCancel: boolean;
};

const mapStatus = (
  status: string,
): { readonly label: string; readonly variant: BadgeVariant; readonly cancelable: boolean } => {
  switch (status) {
    case "active":
      return { label: "Active", variant: "default", cancelable: true };
    case "trialing":
      return { label: "Trialing", variant: "default", cancelable: true };
    case "past_due":
      return { label: "Past due", variant: "destructive", cancelable: true };
    case "unpaid":
      return { label: "Unpaid", variant: "destructive", cancelable: true };
    case "incomplete":
      return { label: "Incomplete", variant: "secondary", cancelable: true };
    case "incomplete_expired":
      return { label: "Incomplete (expired)", variant: "secondary", cancelable: false };
    case "canceled":
      return { label: "Canceled", variant: "outline", cancelable: false };
    case "paused":
      return { label: "Paused", variant: "secondary", cancelable: true };
    default:
      return { label: status, variant: "secondary", cancelable: true };
  }
};

export const computeBillingPanelView = (subscription: CurrentSubscription): BillingPanelView => {
  if (subscription === null) {
    return {
      hasSubscription: false,
      statusLabel: "No subscription",
      statusVariant: "secondary",
      currentPeriodEndLabel: null,
      canStart: true,
      canCancel: false,
    };
  }
  const mapped = mapStatus(subscription.status);
  return {
    hasSubscription: true,
    statusLabel: mapped.label,
    statusVariant: mapped.variant,
    currentPeriodEndLabel: formatDayOrNull(subscription.currentPeriodEnd),
    canStart: false,
    canCancel: mapped.cancelable,
  };
};

export type BillingPanelViewModel = BillingPanelView & {
  readonly start: () => void;
  readonly cancel: () => void;
  readonly isStarting: boolean;
  readonly isCanceling: boolean;
};

const BILLING_ERRORS = {
  BadGateway: (error: { readonly message: string }) => error.message,
  Forbidden: (error: { readonly message: string }) => error.message,
};

export const useBillingPanelViewModel = (orgId: OrganizationId): BillingPanelViewModel => {
  const { data } = useSuspenseQuery(subscriptionQuery(orgId));
  const view = React.useMemo(() => computeBillingPanelView(data), [data]);
  const invalidates = [queryKeys.billing.all];

  const starting = useApiMutation({
    mutationFn: () => startSubscription(orgId),
    invalidates,
    notify: {
      success: () => "Subscription started!",
      errors: { ...BILLING_ERRORS, SubscriptionAlreadyExistsError: (error) => error.message },
    },
  });
  const canceling = useApiMutation({
    mutationFn: () => cancelSubscription(orgId),
    invalidates,
    notify: {
      success: () => "Subscription canceled.",
      errors: { ...BILLING_ERRORS, SubscriptionNotFoundError: (error) => error.message },
    },
  });

  return {
    ...view,
    start: () => {
      starting.mutate(undefined);
    },
    cancel: () => {
      canceling.mutate(undefined);
    },
    isStarting: starting.isPending,
    isCanceling: canceling.isPending,
  };
};
