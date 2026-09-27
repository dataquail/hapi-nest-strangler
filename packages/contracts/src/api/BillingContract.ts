import { z } from "zod";

import { OrganizationId, SubscriptionId } from "../EntityIds.js";
import {
  BadGateway,
  BadRequest,
  defineError,
  Forbidden,
  ServiceUnavailable,
  Unauthorized,
} from "../HttpErrors.js";
import { defineGroup, defineRoute } from "../Route.js";

export const SubscriptionNotFoundError = defineError(
  "SubscriptionNotFoundError",
  404,
  { organizationId: OrganizationId, message: z.string() },
  "The organization has no subscription",
);

export const SubscriptionAlreadyExistsError = defineError(
  "SubscriptionAlreadyExistsError",
  409,
  { organizationId: OrganizationId, message: z.string() },
  "The organization already has a subscription",
);

export const SubscriptionResponse = z
  .object({
    id: SubscriptionId,
    organizationId: OrganizationId,
    status: z.string(),
    currentPeriodEnd: z.iso.datetime().nullable(),
  })
  .meta({ id: "SubscriptionResponse" });
export type SubscriptionResponse = z.infer<typeof SubscriptionResponse>;

export const StartSubscriptionPayload = z.object({}).meta({ id: "StartSubscriptionPayload" });
export type StartSubscriptionPayload = z.infer<typeof StartSubscriptionPayload>;

const OrgParams = z.object({ orgId: OrganizationId });

export const PrivateGroup = defineGroup({
  name: "billing",
  routes: {
    startSubscription: defineRoute({
      method: "post",
      path: "/orgs/{orgId}/billing/subscriptions",
      operationId: "billing.startSubscription",
      params: OrgParams,
      body: StartSubscriptionPayload,
      success: { status: 201, schema: SubscriptionResponse },
      errors: [Forbidden, BadGateway, SubscriptionAlreadyExistsError, ServiceUnavailable],
      security: "session",
    }),
    getCurrentSubscription: defineRoute({
      method: "get",
      path: "/orgs/{orgId}/billing/subscriptions/current",
      operationId: "billing.getCurrentSubscription",
      params: OrgParams,
      success: { status: 200, schema: SubscriptionResponse },
      errors: [Forbidden, SubscriptionNotFoundError, ServiceUnavailable],
      security: "session",
    }),
    cancelSubscription: defineRoute({
      method: "delete",
      path: "/orgs/{orgId}/billing/subscriptions/current",
      operationId: "billing.cancelSubscription",
      params: OrgParams,
      success: { status: 200, schema: SubscriptionResponse },
      errors: [Forbidden, BadGateway, SubscriptionNotFoundError, ServiceUnavailable],
      security: "session",
    }),
  },
});

export const PublicGroup = defineGroup({
  name: "billingWebhooks",
  routes: {
    handleStripeWebhook: defineRoute({
      method: "post",
      path: "/webhooks/stripe",
      operationId: "billingWebhooks.handleStripeWebhook",
      summary:
        "Stripe webhook receiver; the raw body is verified against the stripe-signature header",
      success: { status: 204, schema: undefined },
      errors: [Unauthorized, BadRequest, ServiceUnavailable],
      security: "public",
    }),
  },
});
