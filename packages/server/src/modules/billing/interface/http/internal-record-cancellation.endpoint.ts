import { Body, Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { InternalBillingContract } from "@org/contracts/api/Contracts";
import type { z } from "zod";

import { RecordCancellationCommand } from "@/modules/billing/commands/record-cancellation.command.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { InterServiceAuthGuard } from "@/platform/middlewares/inter-service-auth.guard.js";

import { toContract } from "./internal-record-subscription.endpoint.js";

const route = InternalBillingContract.Group.routes.recordCancellation;

@Controller()
@UseGuards(InterServiceAuthGuard)
export class InternalRecordCancellationEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async record(
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
    @Body(zodPipe(route.body)) body: z.infer<typeof route.body>,
  ): Promise<InternalBillingContract.InternalSubscription> {
    const subscription = unwrapOrThrow(
      await this.commandBus.execute(
        new RecordCancellationCommand({
          organizationId: params.organizationId,
          canceledAt: new Date(body.canceledAt),
        }),
      ),
      {
        SubscriptionNotFound: (error) =>
          problem(InternalBillingContract.InternalSubscriptionNotFoundError, {
            message: `No subscription for organization ${error.organizationId} is mirrored here`,
          }),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return toContract(subscription);
  }
}
