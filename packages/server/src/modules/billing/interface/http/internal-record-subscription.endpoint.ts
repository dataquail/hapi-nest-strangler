import { Body, Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { InternalBillingContract } from "@org/contracts/api/Contracts";
import type { z } from "zod";

import { RecordSubscriptionCommand } from "@/modules/billing/commands/record-subscription.command.js";
import type { SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { InterServiceAuthGuard } from "@/platform/middlewares/inter-service-auth.guard.js";

const route = InternalBillingContract.Group.routes.recordSubscription;

const toContract = (
  subscription: SubscriptionRoot,
): InternalBillingContract.InternalSubscription => ({
  id: subscription.id,
  organizationId: subscription.organizationId,
  stripeCustomerId: subscription.stripeCustomerId,
  stripeSubscriptionId: subscription.stripeSubscriptionId,
  status: subscription.status,
  currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
});

@Controller()
@UseGuards(InterServiceAuthGuard)
export class InternalRecordSubscriptionEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async record(
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
    @Body(zodPipe(route.body)) body: z.infer<typeof route.body>,
  ): Promise<InternalBillingContract.InternalSubscription> {
    const subscription = unwrapOrThrow(
      await this.commandBus.execute(
        new RecordSubscriptionCommand({
          id: body.id,
          organizationId: params.organizationId,
          stripeCustomerId: body.stripeCustomerId,
          stripeSubscriptionId: body.stripeSubscriptionId,
          status: body.status,
          currentPeriodEnd: body.currentPeriodEnd === null ? null : new Date(body.currentPeriodEnd),
          createdAt: new Date(body.createdAt),
        }),
      ),
      {
        SubscriptionAlreadyExistsForOrganization: (error) =>
          problem(InternalBillingContract.InternalSubscriptionAlreadyExistsError, {
            message: `A subscription for organization ${error.organizationId} is already mirrored here`,
          }),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return toContract(subscription);
  }
}
