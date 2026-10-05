import { z } from "zod";

import { OrganizationId, SubscriptionId } from "../EntityIds.js";
import { defineError, ServiceUnavailable } from "../HttpErrors.js";
import { defineGroup, defineRoute } from "../Route.js";

export const InternalSubscriptionAlreadyExistsError = defineError(
  "InternalSubscriptionAlreadyExistsError",
  409,
  { message: z.string() },
  "A subscription for that organization has already been mirrored to this server",
);

export const InternalSubscription = z
  .object({
    id: SubscriptionId,
    organizationId: OrganizationId,
    stripeCustomerId: z.string(),
    stripeSubscriptionId: z.string(),
    status: z.string(),
    currentPeriodEnd: z.iso.datetime().nullable(),
  })
  .meta({ id: "InternalSubscription" });
export type InternalSubscription = z.infer<typeof InternalSubscription>;

export const InternalRecordSubscriptionPayload = z
  .object({
    id: SubscriptionId,
    stripeCustomerId: z.string().min(1),
    stripeSubscriptionId: z.string().min(1),
    status: z.string().min(1),
    currentPeriodEnd: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "InternalRecordSubscriptionPayload" });
export type InternalRecordSubscriptionPayload = z.infer<typeof InternalRecordSubscriptionPayload>;

const OrgParams = z.object({ organizationId: OrganizationId });

// Service-to-service only: while the legacy API owns billing it mirrors every
// write here after the provider has answered it, so these routes record what
// happened and never call the provider themselves.
export const Group = defineGroup({
  name: "internal-billing",
  routes: {
    recordSubscription: defineRoute({
      method: "post",
      path: "/internal/orgs/{organizationId}/billing/subscriptions",
      operationId: "internalBilling.recordSubscription",
      params: OrgParams,
      body: InternalRecordSubscriptionPayload,
      success: { status: 201, schema: InternalSubscription },
      errors: [InternalSubscriptionAlreadyExistsError, ServiceUnavailable],
      security: "service",
    }),
  },
});
