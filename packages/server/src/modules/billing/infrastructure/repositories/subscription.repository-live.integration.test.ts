import { deepStrictEqual, ok } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import type { SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "@/modules/billing/domain/subscription/subscription.specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { createTestDatabase, runTestMigrations, truncate } from "@/test-utils/test-database.js";

import { SubscriptionRepositoryLive } from "./subscription.repository-live.js";

const acme = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const beta = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const subA = SubscriptionId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const subB = SubscriptionId.parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = new Date("2025-01-01T00:00:00Z");
const periodEnd = new Date("2025-02-01T00:00:00Z");

const mk = (
  id: SubscriptionId,
  organizationId: OrganizationId,
  stripeSub: string,
  status = "active",
): SubscriptionRoot =>
  SubscriptionRootOps.create({
    id,
    organizationId,
    stripeCustomerId: `cus_${organizationId}`,
    stripeSubscriptionId: stripeSub,
    status,
    currentPeriodEnd: periodEnd,
    now,
  }).subscription;

// The FK precondition is a cross-module row; direct SQL is the smallest seam.
const seedOrgRow = (db: Database, id: OrganizationId, name: string) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${id}, ${name}, now(), now(), null)
  `);

describe.sequential("SubscriptionRepositoryLive (integration)", () => {
  let db: Database;
  let repo: SubscriptionRepositoryLive;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
    repo = new SubscriptionRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "billing.subscriptions", "organization.organizations");
  });

  it("persists and decodes back via findOne(forOrganization)", async () => {
    await seedOrgRow(db, acme, "Acme");
    (await repo.insertOne(mk(subA, acme, "sub_acme"))).unwrap();
    const found = (await repo.findOne(SubscriptionSpecifications.forOrganization(acme))).unwrap();
    ok(found !== null);
    deepStrictEqual(found.id, subA);
    deepStrictEqual(found.stripeSubscriptionId, "sub_acme");
    deepStrictEqual(found.status, "active");
    deepStrictEqual(found.currentPeriodEnd, periodEnd);
  });

  it("fails SubscriptionAlreadyExistsForOrganization on duplicate org", async () => {
    await seedOrgRow(db, acme, "Acme");
    (await repo.insertOne(mk(subA, acme, "sub_a"))).unwrap();
    const result = await repo.insertOne(mk(subB, acme, "sub_b"));
    deepStrictEqual(result.unwrapErr()._tag, "SubscriptionAlreadyExistsForOrganization");
  });

  it("update replaces status, currentPeriodEnd, updatedAt for the matching id", async () => {
    await seedOrgRow(db, acme, "Acme");
    const sub = mk(subA, acme, "sub_acme");
    (await repo.insertOne(sub)).unwrap();
    (await repo.updateOne(SubscriptionRootOps.cancel(sub, now).subscription)).unwrap();
    deepStrictEqual(
      (await repo.findOne(SubscriptionSpecifications.forOrganization(acme))).unwrap()?.status,
      "canceled",
    );
  });

  it("findOne by Stripe subscription id is cross-tenant safe", async () => {
    await seedOrgRow(db, acme, "Acme");
    await seedOrgRow(db, beta, "Beta");
    (await repo.insertOne(mk(subA, acme, "sub_acme_id"))).unwrap();
    (await repo.insertOne(mk(subB, beta, "sub_beta_id"))).unwrap();
    const found = (
      await repo.findOne(SubscriptionSpecifications.withStripeSubscriptionId("sub_beta_id"))
    ).unwrap();
    ok(found !== null);
    deepStrictEqual(found.id, subB);
    deepStrictEqual(found.organizationId, beta);
    deepStrictEqual(
      (
        await repo.findOne(SubscriptionSpecifications.withStripeSubscriptionId("sub_unknown"))
      ).unwrap(),
      null,
    );
  });
});
