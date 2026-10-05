import type { RowSchemas } from "@org/database";

import type { WebhookEventRecord } from "@/modules/billing/domain/webhook-event/webhook-event.repository.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = {
  stripeEventId: "stripe_event_id",
} as const satisfies Partial<Record<keyof WebhookEventRecord, string>> & ColumnMap;

export const toDomain = (row: RowSchemas.WebhookEventRow): WebhookEventRecord => ({
  stripeEventId: row.stripe_event_id,
  receivedAt: row.received_at,
});
