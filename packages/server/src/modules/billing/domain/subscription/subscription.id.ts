import { z } from "zod";

export const SubscriptionId = z.guid().brand<"SubscriptionId">();
export type SubscriptionId = z.infer<typeof SubscriptionId>;
