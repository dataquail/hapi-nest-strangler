import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type {
  BillingGatewayUnavailable,
  SubscriptionNotFound,
} from "../domain/subscription/subscription.errors.js";
import type { SubscriptionRoot } from "../domain/subscription/subscription.root.js";

export type CancelSubscriptionPayload = { readonly organizationId: OrganizationId };

export type CancelSubscriptionResult = Result<
  SubscriptionRoot,
  SubscriptionNotFound | BillingGatewayUnavailable | PersistenceUnavailable
>;

export class CancelSubscriptionCommand extends Command<CancelSubscriptionResult> {
  constructor(public readonly payload: CancelSubscriptionPayload) {
    super();
  }
}
