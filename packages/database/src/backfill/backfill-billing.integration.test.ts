import { deepStrictEqual } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { z } from "zod";

import { type Database, sql } from "../database.js";
import { createTestDatabase } from "../test-utils/test-database.js";
import { backfillBilling } from "./backfill-billing.js";

const acme = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const beta = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const gone = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const kept = "11111111-1111-1111-1111-111111111111";
const changed = "22222222-2222-2222-2222-222222222222";
const stale = "33333333-3333-3333-3333-333333333333";

const ReplicaRow = z.object({ id: z.guid(), status: z.string() });
const EventRow = z.object({ stripe_event_id: z.string() });

const seed = async (
  db: Database,
  table: "public" | "billing",
  id: string,
  organizationId: string,
  status: string,
) => {
  const values = sql.fragment`(${id}, ${organizationId}, ${`cus_${id}`}, ${`sub_${id}`}, ${status})`;
  if (table === "public") {
    await db.exec(sql.unsafe`
      INSERT INTO public.subscriptions
        (id, organization_id, stripe_customer_id, stripe_subscription_id, status)
      VALUES ${values}
    `);
  } else {
    await db.exec(sql.unsafe`
      INSERT INTO billing.subscriptions
        (id, organization_id, stripe_customer_id, stripe_subscription_id, status)
      VALUES ${values}
    `);
  }
};

const replica = (db: Database) =>
  db.any(sql.type(ReplicaRow)`SELECT id, status FROM billing.subscriptions ORDER BY id`);
const claims = (db: Database) =>
  db.any(
    sql.type(EventRow)`SELECT stripe_event_id FROM billing.webhook_events ORDER BY stripe_event_id`,
  );

describe.sequential("backfillBilling (integration)", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await db.exec(sql.unsafe`TRUNCATE TABLE billing.subscriptions, billing.webhook_events`);
    await db.exec(
      sql.unsafe`TRUNCATE TABLE public.subscriptions, public.webhook_events, public.organizations CASCADE`,
    );
    await db.exec(sql.unsafe`
      INSERT INTO public.organizations (id, name) VALUES (${acme}, 'Acme'), (${beta}, 'Beta')
    `);
  });

  it("copies what the legacy tables have, overwrites what drifted, drops what they lost", async () => {
    await seed(db, "public", kept, acme, "active");
    await seed(db, "public", changed, beta, "canceled");
    await seed(db, "billing", changed, beta, "active");
    await seed(db, "billing", stale, gone, "active");
    await db.exec(sql.unsafe`
      INSERT INTO public.webhook_events (stripe_event_id) VALUES ('evt_1'), ('evt_2')
    `);
    await db.exec(sql.unsafe`
      INSERT INTO billing.webhook_events (stripe_event_id) VALUES ('evt_1'), ('evt_lost')
    `);

    deepStrictEqual(await backfillBilling(db), {
      subscriptions: { upserted: 2, deleted: 1 },
      webhookEvents: { upserted: 2, deleted: 1 },
    });
    deepStrictEqual(await replica(db), [
      { id: kept, status: "active" },
      { id: changed, status: "canceled" },
    ]);
    deepStrictEqual(await claims(db), [{ stripe_event_id: "evt_1" }, { stripe_event_id: "evt_2" }]);
  });

  it("is idempotent: a second run leaves the replica as the first left it", async () => {
    await seed(db, "public", kept, acme, "active");
    await db.exec(sql.unsafe`INSERT INTO public.webhook_events (stripe_event_id) VALUES ('evt_1')`);
    await backfillBilling(db);
    deepStrictEqual(await backfillBilling(db), {
      subscriptions: { upserted: 1, deleted: 0 },
      webhookEvents: { upserted: 1, deleted: 0 },
    });
    deepStrictEqual(await replica(db), [{ id: kept, status: "active" }]);
    deepStrictEqual(await claims(db), [{ stripe_event_id: "evt_1" }]);
  });
});
