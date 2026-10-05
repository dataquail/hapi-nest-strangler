import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { SubscriptionNotFound } from "../domain/subscription/subscription.errors.js";
import { SubscriptionRepository } from "../domain/subscription/subscription.repository.js";
import { SubscriptionRootOps } from "../domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "../domain/subscription/subscription.specification.js";
import {
  RecordCancellationCommand,
  type RecordCancellationResult,
} from "./record-cancellation.command.js";

@CommandHandler(RecordCancellationCommand)
export class RecordCancellationHandler implements ICommandHandler<RecordCancellationCommand> {
  constructor(
    @Inject(SubscriptionRepository) private readonly subscriptions: SubscriptionRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: RecordCancellationCommand): Promise<RecordCancellationResult> {
    return this.unitOfWork.run<RecordCancellationResult>(async () => {
      const found = await this.subscriptions.findOne(
        SubscriptionSpecifications.forOrganization(payload.organizationId),
      );
      if (found.isErr()) return found;
      const existing = found.unwrap();
      if (existing === null)
        return Err(new SubscriptionNotFound({ organizationId: payload.organizationId }));
      const { subscription } = SubscriptionRootOps.cancel(existing, payload.canceledAt);
      const updated = await this.subscriptions.updateOne(subscription);
      if (updated.isErr()) return updated;
      return Ok(subscription);
    });
  }
}
