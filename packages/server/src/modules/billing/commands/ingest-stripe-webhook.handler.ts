import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { BillingGateway } from "../domain/ports/clients/billing-gateway.client.js";
import { StripeWebhookIngested } from "../domain/webhook-event/stripe-webhook.events.js";
import { WebhookEventRepository } from "../domain/webhook-event/webhook-event.repository.js";
import {
  IngestStripeWebhookCommand,
  type IngestStripeWebhookResult,
} from "./ingest-stripe-webhook.command.js";

// Verification happens outside the unit of work: a bad signature must not
// consume a row. The try-insert is the idempotency claim; a redelivery hits
// the unique key and short-circuits without emitting the domain event.
@CommandHandler(IngestStripeWebhookCommand)
export class IngestStripeWebhookHandler implements ICommandHandler<IngestStripeWebhookCommand> {
  constructor(
    @Inject(BillingGateway) private readonly gateway: BillingGateway,
    @Inject(WebhookEventRepository) private readonly webhookEvents: WebhookEventRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public async execute({
    payload,
  }: IngestStripeWebhookCommand): Promise<IngestStripeWebhookResult> {
    const verified = await this.gateway.verifyAndParseWebhook({
      payload: payload.payload,
      signature: payload.signature,
    });
    if (verified.isErr()) return verified;
    const stripeEvent = verified.unwrap();

    return this.unitOfWork.run<IngestStripeWebhookResult>(async () => {
      const claimed = await this.webhookEvents.insertOne(stripeEvent.eventId);
      if (claimed.isErr()) {
        const error = claimed.unwrapErr();
        return error._tag === "WebhookEventAlreadyRecorded" ? Ok(undefined) : Err(error);
      }
      await this.events.dispatch([StripeWebhookIngested.make({ stripeEvent })]);
      return Ok(undefined);
    });
  }
}
