import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { SyncSubscriptionCommand } from "@/modules/billing/commands/sync-subscription.command.js";
import {
  isStripeSubscriptionEvent,
  StripeWebhookIngested,
} from "@/modules/billing/domain/webhook-event/stripe-webhook.events.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";

// Immediate subscription: runs inside the ingest command's transaction, so
// the dispatched command's own unit of work nests as a savepoint and a
// failure rolls the ingest back. Invoice and unknown events claim no action.
@Injectable()
export class StripeWebhookEventAdapter implements OnModuleInit {
  constructor(
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
  ) {}

  public onModuleInit(): void {
    this.events.subscribe(StripeWebhookIngested, async (event) => {
      const stripeEvent = event.stripeEvent;
      if (!isStripeSubscriptionEvent(stripeEvent)) return;
      const status =
        stripeEvent.type === "customer.subscription.deleted"
          ? "canceled"
          : stripeEvent.subscription.status;
      const result = await this.commandBus.execute(
        new SyncSubscriptionCommand({
          stripeSubscriptionId: stripeEvent.subscription.stripeSubscriptionId,
          status,
          currentPeriodEnd: stripeEvent.subscription.currentPeriodEnd,
        }),
      );
      if (result.isErr())
        throw new Error(`SyncSubscriptionCommand failed: ${result.unwrapErr()._tag}`);
    });
  }
}
