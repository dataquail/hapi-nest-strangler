import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { notificationStore } from "@/services/notifications.shared";
import { BILLING_ORG_ID, makeSubscription } from "@/test/fixtures/billing";
import { billingHandlers } from "@/test/handlers/billing";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";

import { computeBillingPanelView, useBillingPanelViewModel } from "./billing-panel.view-model";

const announced = () => notificationStore.get() !== null;

describe("computeBillingPanelView", () => {
  it("returns the empty-state shape when there's no subscription", () => {
    expect(computeBillingPanelView(null)).toEqual({
      hasSubscription: false,
      statusLabel: "No subscription",
      statusVariant: "secondary",
      currentPeriodEndLabel: null,
      canStart: true,
      canCancel: false,
    });
  });

  it.each([
    ["active", "Active", "default", true],
    ["trialing", "Trialing", "default", true],
    ["past_due", "Past due", "destructive", true],
    ["unpaid", "Unpaid", "destructive", true],
    ["incomplete", "Incomplete", "secondary", true],
    ["incomplete_expired", "Incomplete (expired)", "secondary", false],
    ["canceled", "Canceled", "outline", false],
    ["paused", "Paused", "secondary", true],
  ] as const)("maps Stripe's %s to %s", (status, label, variant, cancelable) => {
    expect(computeBillingPanelView(makeSubscription({ status }))).toMatchObject({
      hasSubscription: true,
      statusLabel: label,
      statusVariant: variant,
      canStart: false,
      canCancel: cancelable,
    });
  });

  it("renders a status it has never seen verbatim, rather than crashing", () => {
    const view = computeBillingPanelView(makeSubscription({ status: "some_new_stripe_status" }));
    expect(view.statusLabel).toBe("some_new_stripe_status");
    expect(view.statusVariant).toBe("secondary");
  });

  it("formats the period end as a day, or none when the subscription carries none", () => {
    expect(computeBillingPanelView(makeSubscription()).currentPeriodEndLabel).toBe("2026-03-01");
    expect(
      computeBillingPanelView(makeSubscription({ currentPeriodEnd: null })).currentPeriodEndLabel,
    ).toBeNull();
  });
});

describe("billing panel ViewModel", () => {
  it("reads the org's current subscription", async () => {
    server.use(billingHandlers.current(makeSubscription({ status: "trialing" })));

    const view = await renderViewModel(() => useBillingPanelViewModel(BILLING_ORG_ID)).settle(
      () => true,
    );

    expect(view).toMatchObject({ hasSubscription: true, statusLabel: "Trialing" });
  });

  it("treats the server's 404 as 'no subscription yet', not as a failure", async () => {
    server.use(billingHandlers.current(null));

    const view = await renderViewModel(() => useBillingPanelViewModel(BILLING_ORG_ID)).settle(
      () => true,
    );

    expect(view).toMatchObject({ hasSubscription: false, canStart: true, canCancel: false });
  });

  it("announces a started subscription", async () => {
    server.use(billingHandlers.current(null), billingHandlers.start());

    const harness = renderViewModel(() => useBillingPanelViewModel(BILLING_ORG_ID));
    await harness.settle(() => true);

    act(() => {
      harness.result.current.start();
    });
    await harness.settle(announced);

    expect(notificationStore.get()).toMatchObject({
      kind: "success",
      message: "Subscription started!",
    });
  });

  it("surfaces a Stripe outage rather than claiming the subscription started", async () => {
    server.use(billingHandlers.current(null), billingHandlers.start({ result: "BadGateway" }));

    const harness = renderViewModel(() => useBillingPanelViewModel(BILLING_ORG_ID));
    await harness.settle(() => true);

    act(() => {
      harness.result.current.start();
    });
    await harness.settle(announced);

    expect(notificationStore.get()).toMatchObject({
      kind: "error",
      message: "Stripe is unreachable.",
    });
  });

  it("announces a cancellation", async () => {
    server.use(billingHandlers.current(), billingHandlers.cancel());

    const harness = renderViewModel(() => useBillingPanelViewModel(BILLING_ORG_ID));
    await harness.settle(() => true);

    act(() => {
      harness.result.current.cancel();
    });
    await harness.settle(announced);

    expect(notificationStore.get()).toMatchObject({
      kind: "success",
      message: "Subscription canceled.",
    });
  });
});
