import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { SubscriptionRepository } from "../domain/subscription/subscription.repository.js";
import { SubscriptionRootOps } from "../domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "../domain/subscription/subscription.specification.js";
import { WebhookEventRepository } from "../domain/webhook-event/webhook-event.repository.js";
import {
  RecordWebhookEventCommand,
  type RecordWebhookEventResult,
} from "./record-webhook-event.command.js";

// A redelivered forward finds its claim taken and changes nothing; an event for
// a subscription this side has not seen is dropped, as the legacy API drops it.
@CommandHandler(RecordWebhookEventCommand)
export class RecordWebhookEventHandler implements ICommandHandler<RecordWebhookEventCommand> {
  constructor(
    @Inject(WebhookEventRepository) private readonly webhookEvents: WebhookEventRepository,
    @Inject(SubscriptionRepository) private readonly subscriptions: SubscriptionRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: RecordWebhookEventCommand): Promise<RecordWebhookEventResult> {
    return this.unitOfWork.run<RecordWebhookEventResult>(async () => {
      const claimed = await this.webhookEvents.insertOne(payload.stripeEventId);
      if (claimed.isErr()) {
        const error = claimed.unwrapErr();
        return error._tag === "WebhookEventAlreadyRecorded" ? Ok(undefined) : Err(error);
      }
      const state = payload.subscription;
      if (state === null) return Ok(undefined);
      const found = await this.subscriptions.findOne(
        SubscriptionSpecifications.withStripeSubscriptionId(state.stripeSubscriptionId),
      );
      if (found.isErr()) return found;
      const existing = found.unwrap();
      if (existing === null) return Ok(undefined);
      const { subscription } = SubscriptionRootOps.applyStatus(existing, {
        status: state.status,
        currentPeriodEnd: state.currentPeriodEnd,
        now: payload.receivedAt,
      });
      return this.subscriptions.updateOne(subscription);
    });
  }
}
