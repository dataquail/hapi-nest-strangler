import { deepStrictEqual, ok } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { createTestDatabase, runTestMigrations, truncate } from "@/test-utils/test-database.js";

import { SubscriptionId } from "../domain/subscription/subscription.id.js";
import { SubscriptionRootOps } from "../domain/subscription/subscription.root-ops.js";
import { SubscriptionRepositoryLive } from "../infrastructure/repositories/subscription.repository-live.js";
import { FindSubscriptionByOrganizationHandler } from "./find-subscription-by-organization.handler.js";
import { FindSubscriptionByOrganizationQuery } from "./find-subscription-by-organization.query.js";

const acme = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const beta = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const subId = SubscriptionId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

const seedOrg = (db: Database, id: OrganizationId, name: string) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${id}, ${name}, now(), now(), null)
  `);

describe.sequential("FindSubscriptionByOrganizationHandler (integration)", () => {
  let db: Database;
  let repo: SubscriptionRepositoryLive;
  let handler: FindSubscriptionByOrganizationHandler;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
    repo = new SubscriptionRepositoryLive(db);
    handler = new FindSubscriptionByOrganizationHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "billing.subscriptions", "organization.organizations");
  });

  it("returns the view when a subscription exists, mapped to the cross-boundary shape", async () => {
    await seedOrg(db, acme, "Acme");
    const { subscription } = SubscriptionRootOps.create({
      id: subId,
      organizationId: acme,
      stripeCustomerId: "cus_acme",
      stripeSubscriptionId: "sub_acme",
      status: "active",
      currentPeriodEnd: null,
      now: new Date("2025-01-01T00:00:00Z"),
    });
    (await repo.insertOne(subscription)).unwrap();
    const result = (
      await handler.execute(new FindSubscriptionByOrganizationQuery({ organizationId: acme }))
    ).unwrap();
    ok(result !== null);
    deepStrictEqual(result.id, subId);
    deepStrictEqual(result.organizationId, acme);
    deepStrictEqual(result.status, "active");
    deepStrictEqual("stripeSubscriptionId" in result, false);
  });

  it("returns null when no subscription exists for the org", async () => {
    await seedOrg(db, beta, "Beta");
    deepStrictEqual(
      (
        await handler.execute(new FindSubscriptionByOrganizationQuery({ organizationId: beta }))
      ).unwrap(),
      null,
    );
  });
});
