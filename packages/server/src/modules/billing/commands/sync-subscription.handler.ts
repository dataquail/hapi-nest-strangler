import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Ok } from "oxide.ts";

import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { SubscriptionRepository } from "../domain/subscription/subscription.repository.js";
import { SubscriptionRootOps } from "../domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "../domain/subscription/subscription.specification.js";
import {
  SyncSubscriptionCommand,
  type SyncSubscriptionResult,
} from "./sync-subscription.command.js";

// An out-of-order delivery for a subscription whose `created` has not been
// observed finds no row and is dropped; the eventual `created` resyncs.
@CommandHandler(SyncSubscriptionCommand)
export class SyncSubscriptionHandler implements ICommandHandler<SyncSubscriptionCommand> {
  constructor(
    @Inject(SubscriptionRepository) private readonly subscriptions: SubscriptionRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: SyncSubscriptionCommand): Promise<SyncSubscriptionResult> {
    return this.unitOfWork.run<SyncSubscriptionResult>(async () => {
      const found = await this.subscriptions.findOne(
        SubscriptionSpecifications.withStripeSubscriptionId(payload.stripeSubscriptionId),
      );
      if (found.isErr()) return found;
      const existing = found.unwrap();
      if (existing === null) return Ok(undefined);
      const { events, subscription } = SubscriptionRootOps.applyStatus(existing, {
        status: payload.status,
        currentPeriodEnd: payload.currentPeriodEnd,
        now: new Date(),
      });
      const updated = await this.subscriptions.updateOne(subscription);
      if (updated.isErr()) return updated;
      await this.events.dispatch(events);
      return Ok(undefined);
    });
  }
}
