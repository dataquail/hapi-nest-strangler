import { type Database, sql } from "../database.js";

export type BackfillReport = { readonly upserted: number; readonly deleted: number };

export type BillingBackfillReport = {
  readonly subscriptions: BackfillReport;
  readonly webhookEvents: BackfillReport;
};

// Squares the Nest replica with the legacy tables once every write is
// mirrored: the legacy API is still the source of truth, so its rows win and
// a row it no longer has goes. The claimed webhook events come too, so a
// delivery Stripe repeats after the cutover is still recognised. Idempotent.
export const backfillBilling = (db: Database): Promise<BillingBackfillReport> =>
  db.withTransaction(async () => {
    const subscriptionsUpserted = await db.exec(sql.unsafe`
      INSERT INTO billing.subscriptions
        (id, organization_id, stripe_customer_id, stripe_subscription_id, status,
         current_period_end, created_at, updated_at)
      SELECT id, organization_id, stripe_customer_id, stripe_subscription_id, status,
             current_period_end, created_at, updated_at
      FROM public.subscriptions
      ON CONFLICT (id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        stripe_customer_id = EXCLUDED.stripe_customer_id,
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        status = EXCLUDED.status,
        current_period_end = EXCLUDED.current_period_end,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
    `);
    const subscriptionsDeleted = await db.exec(sql.unsafe`
      DELETE FROM billing.subscriptions WHERE id NOT IN (SELECT id FROM public.subscriptions)
    `);
    const eventsUpserted = await db.exec(sql.unsafe`
      INSERT INTO billing.webhook_events (stripe_event_id, received_at)
      SELECT stripe_event_id, received_at FROM public.webhook_events
      ON CONFLICT (stripe_event_id) DO UPDATE SET received_at = EXCLUDED.received_at
    `);
    const eventsDeleted = await db.exec(sql.unsafe`
      DELETE FROM billing.webhook_events
      WHERE stripe_event_id NOT IN (SELECT stripe_event_id FROM public.webhook_events)
    `);
    return {
      subscriptions: { upserted: subscriptionsUpserted, deleted: subscriptionsDeleted },
      webhookEvents: { upserted: eventsUpserted, deleted: eventsDeleted },
    };
  });
