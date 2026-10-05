import { z } from "zod";

export const WebhookEventRow = z.object({
  stripe_event_id: z.string(),
  received_at: z.date(),
});
export type WebhookEventRow = z.infer<typeof WebhookEventRow>;
