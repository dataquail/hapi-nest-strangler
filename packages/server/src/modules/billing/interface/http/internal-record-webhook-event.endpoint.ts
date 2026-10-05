import { Body, Controller, Inject, UseGuards } from "@nestjs/common";
import { InternalBillingContract } from "@org/contracts/api/Contracts";
import type { z } from "zod";

import { RecordWebhookEventCommand } from "@/modules/billing/commands/record-webhook-event.command.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { InterServiceAuthGuard } from "@/platform/middlewares/inter-service-auth.guard.js";

const route = InternalBillingContract.Group.routes.recordWebhookEvent;

@Controller()
@UseGuards(InterServiceAuthGuard)
export class InternalRecordWebhookEventEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async record(@Body(zodPipe(route.body)) body: z.infer<typeof route.body>): Promise<void> {
    const state = body.subscription;
    unwrapOrThrow(
      await this.commandBus.execute(
        new RecordWebhookEventCommand({
          stripeEventId: body.stripeEventId,
          receivedAt: new Date(body.receivedAt),
          subscription:
            state === null
              ? null
              : {
                  stripeSubscriptionId: state.stripeSubscriptionId,
                  status: state.status,
                  currentPeriodEnd:
                    state.currentPeriodEnd === null ? null : new Date(state.currentPeriodEnd),
                },
        }),
      ),
      { PersistenceUnavailable: serviceUnavailable },
    );
  }
}
