import { Module } from "@nestjs/common";

import { billingCommandHandlers } from "./billing.command-handlers.js";
import { SubscriptionRepository } from "./domain/subscription/subscription.repository.js";
import { WebhookEventRepository } from "./domain/webhook-event/webhook-event.repository.js";
import { SubscriptionRepositoryLive } from "./infrastructure/repositories/subscription.repository-live.js";
import { WebhookEventRepositoryLive } from "./infrastructure/repositories/webhook-event.repository-live.js";
import { billingEndpoints } from "./interface/http/index.js";

@Module({
  controllers: [...billingEndpoints],
  providers: [
    ...billingCommandHandlers,
    { provide: SubscriptionRepository, useClass: SubscriptionRepositoryLive },
    { provide: WebhookEventRepository, useClass: WebhookEventRepositoryLive },
  ],
})
export class BillingModule {}
