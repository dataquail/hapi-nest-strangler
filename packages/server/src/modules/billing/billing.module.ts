import { Module } from "@nestjs/common";

import { OrganizationModule } from "@/modules/organization/organization.module.js";
import { RoleModule } from "@/modules/role/role.module.js";

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
import { StripeWebhookEventAdapter } from "./interface/events/stripe-webhook.event-adapter.js";
import { billingEndpoints } from "./interface/http/index.js";
import { BillingPolicyContribution } from "./policies/billing.policies.js";
import { BillingResolverEntry } from "./policies/billing.resource-resolver.js";

// The BillingGateway is deliberately absent: which adapter satisfies it is
// the composition root's choice (Stripe in production, the fake in tests).
@Module({
  imports: [OrganizationModule, RoleModule],
  controllers: [...billingEndpoints],
  providers: [
    ...billingCommandHandlers,
    ...billingQueryHandlers,
    { provide: SubscriptionRepository, useClass: SubscriptionRepositoryLive },
    { provide: WebhookEventRepository, useClass: WebhookEventRepositoryLive },
    { provide: OrganizationAccess, useClass: OrganizationAccessLive },
    { provide: PlatformRoles, useClass: PlatformRolesLive },
    StripeWebhookEventAdapter,
    BillingPolicyContribution,
    BillingResolverEntry,
  ],
  exports: [BillingPolicyContribution, BillingResolverEntry],
})
export class BillingModule {}
