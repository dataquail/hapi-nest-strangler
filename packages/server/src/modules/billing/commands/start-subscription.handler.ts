import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { BillingGateway } from "../domain/ports/clients/billing-gateway.client.js";
import { SubscriptionAlreadyExistsForOrganization } from "../domain/subscription/subscription.errors.js";
import { SubscriptionId } from "../domain/subscription/subscription.id.js";
import { SubscriptionRepository } from "../domain/subscription/subscription.repository.js";
import { SubscriptionRootOps } from "../domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "../domain/subscription/subscription.specification.js";
import {
  StartSubscriptionCommand,
  type StartSubscriptionResult,
} from "./start-subscription.command.js";

// The gateway calls run outside the unit of work: a failed insert after a
// successful create leaves an orphaned provider subscription, which is the
// reconciliation problem left out of scope. The use-case existence check
// stops a retried POST from double-charging.
@CommandHandler(StartSubscriptionCommand)
export class StartSubscriptionHandler implements ICommandHandler<StartSubscriptionCommand> {
  constructor(
    @Inject(SubscriptionRepository) private readonly subscriptions: SubscriptionRepository,
    @Inject(BillingGateway) private readonly gateway: BillingGateway,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public async execute({ payload }: StartSubscriptionCommand): Promise<StartSubscriptionResult> {
    const existing = await this.subscriptions.findOne(
      SubscriptionSpecifications.forOrganization(payload.organizationId),
    );
    if (existing.isErr()) return existing;
    if (existing.unwrap() !== null) {
      return Err(
        new SubscriptionAlreadyExistsForOrganization({ organizationId: payload.organizationId }),
      );
    }

    const customer = await this.gateway.createCustomer({ organizationId: payload.organizationId });
    if (customer.isErr()) return customer;
    const stripeSub = await this.gateway.createSubscription({
      stripeCustomerId: customer.unwrap().stripeCustomerId,
    });
    if (stripeSub.isErr()) return stripeSub;

    const { events, subscription } = SubscriptionRootOps.create({
      id: SubscriptionId.parse(crypto.randomUUID()),
      organizationId: payload.organizationId,
      stripeCustomerId: customer.unwrap().stripeCustomerId,
      stripeSubscriptionId: stripeSub.unwrap().stripeSubscriptionId,
      status: stripeSub.unwrap().status,
      currentPeriodEnd: stripeSub.unwrap().currentPeriodEnd,
      now: new Date(),
    });

    return this.unitOfWork.run<StartSubscriptionResult>(async () => {
      const inserted = await this.subscriptions.insertOne(subscription);
      if (inserted.isErr()) return inserted;
      await this.events.dispatch(events);
      return Ok(subscription);
    });
  }
}
