import { z } from "zod";

export const SubscriptionRow = z.object({
  id: z.guid(),
  organization_id: z.guid(),
  stripe_customer_id: z.string(),
  stripe_subscription_id: z.string(),
  status: z.string(),
  current_period_end: z.date().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});
export type SubscriptionRow = z.infer<typeof SubscriptionRow>;
