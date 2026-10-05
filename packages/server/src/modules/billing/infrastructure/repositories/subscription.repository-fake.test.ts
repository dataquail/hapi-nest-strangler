import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "@/modules/billing/domain/subscription/subscription.specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { SubscriptionRepositoryFake } from "./subscription.repository-fake.js";

const acme = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const beta = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const subA = SubscriptionId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const subB = SubscriptionId.parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = new Date("2025-01-01T00:00:00Z");

const mk = (id: SubscriptionId, organizationId: OrganizationId, stripeSub = "sub_x") =>
  SubscriptionRootOps.create({
    id,
    organizationId,
    stripeCustomerId: "cus_x",
    stripeSubscriptionId: stripeSub,
    status: "active",
    currentPeriodEnd: null,
    now,
  }).subscription;

describe("SubscriptionRepositoryFake", () => {
  it("stores a subscription and makes it findable by organization", async () => {
    const repo = new SubscriptionRepositoryFake();
    (await repo.insertOne(mk(subA, acme))).unwrap();
    const found = (await repo.findOne(SubscriptionSpecifications.forOrganization(acme))).unwrap();
    ok(found !== null);
    deepStrictEqual(found.id, subA);
  });

  it("fails SubscriptionAlreadyExistsForOrganization on duplicate org", async () => {
    const repo = new SubscriptionRepositoryFake();
    (await repo.insertOne(mk(subA, acme))).unwrap();
    const result = await repo.insertOne(mk(subB, acme, "sub_y"));
    deepStrictEqual(result.unwrapErr()._tag, "SubscriptionAlreadyExistsForOrganization");
  });

  it("allows different organizations to each have their own subscription", async () => {
    const repo = new SubscriptionRepositoryFake();
    (await repo.insertOne(mk(subA, acme, "sub_a"))).unwrap();
    (await repo.insertOne(mk(subB, beta, "sub_b"))).unwrap();
    ok((await repo.findOne(SubscriptionSpecifications.forOrganization(acme))).unwrap() !== null);
    ok((await repo.findOne(SubscriptionSpecifications.forOrganization(beta))).unwrap() !== null);
  });

  it("replaces an existing subscription's fields by id", async () => {
    const repo = new SubscriptionRepositoryFake();
    const sub = mk(subA, acme);
    (await repo.insertOne(sub)).unwrap();
    (await repo.updateOne(SubscriptionRootOps.cancel(sub, now).subscription)).unwrap();
    deepStrictEqual(
      (await repo.findOne(SubscriptionSpecifications.forOrganization(acme))).unwrap()?.status,
      "canceled",
    );
  });

  it("finds by Stripe subscription id and returns null when nothing matches", async () => {
    const repo = new SubscriptionRepositoryFake();
    (await repo.insertOne(mk(subA, acme, "sub_unique"))).unwrap();
    deepStrictEqual(
      (
        await repo.findOne(SubscriptionSpecifications.withStripeSubscriptionId("sub_unique"))
      ).unwrap()?.id,
      subA,
    );
    deepStrictEqual(
      (
        await repo.findOne(SubscriptionSpecifications.withStripeSubscriptionId("sub_nope"))
      ).unwrap(),
      null,
    );
    deepStrictEqual(
      (await repo.findOne(SubscriptionSpecifications.forOrganization(beta))).unwrap(),
      null,
    );
  });
});
