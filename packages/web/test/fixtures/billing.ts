import type { BillingContract } from "@org/contracts/api/Contracts";
import { OrganizationId, SubscriptionId } from "@org/contracts/EntityIds";

const FIXED_DATE = "2026-03-01T00:00:00.000Z";

export const BILLING_ORG_ID = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const SUBSCRIPTION_ID = SubscriptionId.parse("22222222-2222-2222-2222-222222222222");

/** A valid `SubscriptionResponse`; `status` defaults to Stripe's `active`. */
export const makeSubscription = (
  overrides: Partial<BillingContract.SubscriptionResponse> = {},
): BillingContract.SubscriptionResponse => ({
  id: SUBSCRIPTION_ID,
  organizationId: BILLING_ORG_ID,
  status: "active",
  currentPeriodEnd: FIXED_DATE,
  ...overrides,
});
