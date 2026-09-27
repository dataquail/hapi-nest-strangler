import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { BillingGateway } from "../domain/ports/clients/billing-gateway.client.js";
import { SubscriptionNotFound } from "../domain/subscription/subscription.errors.js";
import { SubscriptionRepository } from "../domain/subscription/subscription.repository.js";
import { SubscriptionRootOps } from "../domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "../domain/subscription/subscription.specification.js";
import {
  CancelSubscriptionCommand,
  type CancelSubscriptionResult,
} from "./cancel-subscription.command.js";

// Cancels upstream first, then flips local status; a local failure after a
// provider cancel is repaired by the webhook the provider sends anyway.
@CommandHandler(CancelSubscriptionCommand)
export class CancelSubscriptionHandler implements ICommandHandler<CancelSubscriptionCommand> {
  constructor(
    @Inject(SubscriptionRepository) private readonly subscriptions: SubscriptionRepository,
    @Inject(BillingGateway) private readonly gateway: BillingGateway,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public async execute({ payload }: CancelSubscriptionCommand): Promise<CancelSubscriptionResult> {
    const found = await this.subscriptions.findOne(
      SubscriptionSpecifications.forOrganization(payload.organizationId),
    );
    if (found.isErr()) return found;
    const existing = found.unwrap();
    if (existing === null)
      return Err(new SubscriptionNotFound({ organizationId: payload.organizationId }));

    const canceled = await this.gateway.cancelSubscription({
      stripeSubscriptionId: existing.stripeSubscriptionId,
    });
    if (canceled.isErr()) return canceled;

    const { events, subscription } = SubscriptionRootOps.cancel(existing, new Date());
    return this.unitOfWork.run<CancelSubscriptionResult>(async () => {
      const updated = await this.subscriptions.updateOne(subscription);
      if (updated.isErr()) return updated;
      await this.events.dispatch(events);
      return Ok(subscription);
    });
  }
}
