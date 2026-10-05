import { Module } from "@nestjs/common";

import { billingCommandHandlers } from "./billing.command-handlers.js";
import { billingQueryHandlers } from "./billing.query-handlers.js";
import { OrganizationAccess } from "./domain/ports/acl/organization-access.acl.js";
import { PlatformRoles } from "./domain/ports/acl/platform-roles.acl.js";
import { SubscriptionRepository } from "./domain/subscription/subscription.repository.js";
import { WebhookEventRepository } from "./domain/webhook-event/webhook-event.repository.js";
import { OrganizationAccessLive } from "./infrastructure/acl/organization-access.acl-live.js";
import { PlatformRolesLive } from "./infrastructure/acl/platform-roles.acl-live.js";
import { SubscriptionRepositoryLive } from "./infrastructure/repositories/subscription.repository-live.js";
import { WebhookEventRepositoryLive } from "./infrastructure/repositories/webhook-event.repository-live.js";
import { billingEndpoints } from "./interface/http/index.js";
import { BillingPolicyContribution } from "./policies/billing.policies.js";
import { BillingResolverEntry } from "./policies/billing.resource-resolver.js";

// A module states its own imports by importing them (ADR-0032); the contexts
// its ACL ports reach still live on the legacy API, so there are none yet.
@Module({
  controllers: [...billingEndpoints],
  providers: [
    ...billingCommandHandlers,
    ...billingQueryHandlers,
    { provide: SubscriptionRepository, useClass: SubscriptionRepositoryLive },
    { provide: WebhookEventRepository, useClass: WebhookEventRepositoryLive },
    { provide: OrganizationAccess, useClass: OrganizationAccessLive },
    { provide: PlatformRoles, useClass: PlatformRolesLive },
    BillingPolicyContribution,
    BillingResolverEntry,
  ],
  exports: [BillingPolicyContribution, BillingResolverEntry],
})
export class BillingModule {}
