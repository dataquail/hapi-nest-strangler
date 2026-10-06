import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type {
  BillingGatewayUnavailable,
  SubscriptionAlreadyExistsForOrganization,
} from "../domain/subscription/subscription.errors.js";
import type { SubscriptionRoot } from "../domain/subscription/subscription.root.js";

export type StartSubscriptionPayload = { readonly organizationId: OrganizationId };

export type StartSubscriptionResult = Result<
  SubscriptionRoot,
  SubscriptionAlreadyExistsForOrganization | BillingGatewayUnavailable | PersistenceUnavailable
>;

export class StartSubscriptionCommand extends Command<StartSubscriptionResult> {
  constructor(public readonly payload: StartSubscriptionPayload) {
    super();
  }
}
