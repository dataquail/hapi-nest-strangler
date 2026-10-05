import { deepStrictEqual, ok } from "node:assert";

import type { Database } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { WebhookEventSpecifications } from "@/modules/billing/domain/webhook-event/webhook-event.specification.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { WebhookEventRepositoryLive } from "./webhook-event.repository-live.js";

describe.sequential("WebhookEventRepositoryLive (integration)", () => {
  let db: Database;
  let repo: WebhookEventRepositoryLive;

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new WebhookEventRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "billing.webhook_events");
  });

  it("inserts an event id and decodes it back via findOne", async () => {
    (await repo.insertOne("evt_test_1")).unwrap();
    const found = (
      await repo.findOne(WebhookEventSpecifications.withStripeEventId("evt_test_1"))
    ).unwrap();
    ok(found !== null);
    deepStrictEqual(found.stripeEventId, "evt_test_1");
    ok(found.receivedAt instanceof Date);
  });

  it("fails WebhookEventAlreadyRecorded on a duplicate insert (unique violation → domain error)", async () => {
    (await repo.insertOne("evt_test_dup")).unwrap();
    deepStrictEqual(
      (await repo.insertOne("evt_test_dup")).unwrapErr()._tag,
      "WebhookEventAlreadyRecorded",
    );
  });

  it("returns null for an unrecorded event id", async () => {
    deepStrictEqual(
      (await repo.findOne(WebhookEventSpecifications.withStripeEventId("evt_nope"))).unwrap(),
      null,
    );
  });
});
