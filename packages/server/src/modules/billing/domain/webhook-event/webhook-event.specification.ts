import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";

import type { WebhookEventRecord } from "./webhook-event.repository.js";

const withStripeEventId = (stripeEventId: string): Specification<WebhookEventRecord> =>
  Spec.eq<WebhookEventRecord, "stripeEventId">("stripeEventId", stripeEventId);

export const WebhookEventSpecifications = { withStripeEventId } as const;
