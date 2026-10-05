import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Ok } from "oxide.ts";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { SubscriptionRepository } from "../domain/subscription/subscription.repository.js";
import { SubscriptionRootOps } from "../domain/subscription/subscription.root-ops.js";
import {
  RecordSubscriptionCommand,
  type RecordSubscriptionResult,
} from "./record-subscription.command.js";

@CommandHandler(RecordSubscriptionCommand)
export class RecordSubscriptionHandler implements ICommandHandler<RecordSubscriptionCommand> {
  constructor(
    @Inject(SubscriptionRepository) private readonly subscriptions: SubscriptionRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: RecordSubscriptionCommand): Promise<RecordSubscriptionResult> {
    return this.unitOfWork.run<RecordSubscriptionResult>(async () => {
      const { subscription } = SubscriptionRootOps.create({
        id: payload.id,
        organizationId: payload.organizationId,
        stripeCustomerId: payload.stripeCustomerId,
        stripeSubscriptionId: payload.stripeSubscriptionId,
        status: payload.status,
        currentPeriodEnd: payload.currentPeriodEnd,
        now: payload.createdAt,
      });
      const inserted = await this.subscriptions.insertOne(subscription);
      if (inserted.isErr()) return inserted;
      return Ok(subscription);
    });
  }
}
