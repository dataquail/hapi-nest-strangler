import { z } from "zod";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { SubscriptionId } from "./subscription.id.js";

// `status` is a free-form string: Stripe owns the lifecycle vocabulary and
// ships new statuses without notice, and no domain decision branches on it.
export const SubscriptionRoot = z
  .object({
    id: SubscriptionId,
    organizationId: OrganizationId,
    stripeCustomerId: z.string(),
    stripeSubscriptionId: z.string(),
    status: z.string(),
    currentPeriodEnd: z.date().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .readonly();
export type SubscriptionRoot = z.infer<typeof SubscriptionRoot>;
