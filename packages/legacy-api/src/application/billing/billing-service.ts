import type { Server } from "@hapi/hapi";
import type Bookshelf from "bookshelf";
import { randomUUID } from "crypto";
import type { Knex } from "knex";

import { mirrorEvents } from "../../constants/mirror-events";
import { problem } from "../../lib/problem";
import type { StripeGateway, StripeWebhookEvent } from "./stripe-gateway-contract";

type SubscriptionRow = {
  id: string;
  organization_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  current_period_end: Date | null;
  created_at: Date;
  updated_at: Date;
};

const UNIQUE_VIOLATION = "23505";

const toJson = (row: SubscriptionRow) => ({
  id: row.id,
  organizationId: row.organization_id,
  status: row.status,
  currentPeriodEnd:
    row.current_period_end === null ? null : new Date(row.current_period_end).toISOString(),
});

const subscriptionNotFound = (organizationId: string) =>
  problem(404, "SubscriptionNotFoundError", {
    organizationId,
    message: `No subscription found for organization ${organizationId}`,
  });

class BillingService {
  public bookshelf: Bookshelf;
  public stripeGateway: StripeGateway;
  private server: Server;

  constructor(bookshelf: Bookshelf, stripeGateway: StripeGateway, server: Server) {
    this.bookshelf = bookshelf;
    this.stripeGateway = stripeGateway;
    this.server = server;
  }

  // @types/bookshelf is typed against knex 0.21; the instance is knex 2.
  get knex(): Knex {
    return this.bookshelf.knex as unknown as Knex;
  }

  async getCurrent(organization: any) {
    const row: SubscriptionRow | undefined = await this.knex("subscriptions")
      .where({ organization_id: organization.get("id") })
      .first();
    if (!row) throw subscriptionNotFound(organization.get("id"));
    return toJson(row);
  }

  // The provider calls happen outside any transaction: a failed insert after
  // a successful create leaves an orphaned provider subscription, as it always has.
  async startSubscription(organization: any) {
    const organizationId = organization.get("id");
    const existing = await this.knex("subscriptions")
      .where({ organization_id: organizationId })
      .first();
    if (existing) {
      throw problem(409, "SubscriptionAlreadyExistsError", {
        organizationId,
        message: `An active subscription already exists for organization ${organizationId}`,
      });
    }
    const customer = await this.stripeGateway.createCustomer({ organizationId });
    const created = await this.stripeGateway.createSubscription({
      stripeCustomerId: customer.stripeCustomerId,
    });
    const now = new Date();
    const row: SubscriptionRow = {
      id: randomUUID(),
      organization_id: organizationId,
      stripe_customer_id: customer.stripeCustomerId,
      stripe_subscription_id: created.stripeSubscriptionId,
      status: created.status,
      current_period_end: created.currentPeriodEnd,
      created_at: now,
      updated_at: now,
    };
    await this.knex("subscriptions").insert(row);
    this.server.events.emit(mirrorEvents.SUBSCRIPTION_STARTED, {
      id: row.id,
      organizationId: row.organization_id,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      status: row.status,
      currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    });
    return toJson(row);
  }

  // Cancels upstream first, then flips the local status; a local failure after
  // the provider cancel is repaired by the webhook the provider sends anyway.
  async cancelSubscription(organization: any) {
    const row: SubscriptionRow | undefined = await this.knex("subscriptions")
      .where({ organization_id: organization.get("id") })
      .first();
    if (!row) throw subscriptionNotFound(organization.get("id"));
    await this.stripeGateway.cancelSubscription({
      stripeSubscriptionId: row.stripe_subscription_id,
    });
    const now = new Date();
    await this.knex("subscriptions")
      .where({ id: row.id })
      .update({ status: "canceled", updated_at: now });
    this.server.events.emit(mirrorEvents.SUBSCRIPTION_CANCELED, {
      organizationId: row.organization_id,
      canceledAt: now.toISOString(),
    });
    return toJson({ ...row, status: "canceled", updated_at: now });
  }

  // Verification happens before the transaction so a bad signature consumes no
  // row; the insert is the idempotency claim and a redelivery stops there.
  async ingestStripeWebhook(payload: string, signature: string) {
    const event: StripeWebhookEvent = this.stripeGateway.verifyAndParseWebhook({
      payload,
      signature,
    });
    await this.knex.transaction(async (t) => {
      try {
        await this.knex("webhook_events").transacting(t).insert({ stripe_event_id: event.eventId });
      } catch (error: any) {
        if (error?.code === UNIQUE_VIOLATION) return;
        throw error;
      }
      if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        const status =
          event.type === "customer.subscription.deleted" ? "canceled" : event.subscription.status;
        // A delivery for a subscription this side has never seen is dropped; the eventual create resyncs.
        await this.knex("subscriptions")
          .transacting(t)
          .where({ stripe_subscription_id: event.subscription.stripeSubscriptionId })
          .update({
            status,
            current_period_end: event.subscription.currentPeriodEnd,
            updated_at: new Date(),
          });
      }
    });
  }
}

BillingService["@singleton"] = true;
BillingService["@require"] = ["bookshelf", "billing/stripe-gateway", "server"];

export = BillingService;
