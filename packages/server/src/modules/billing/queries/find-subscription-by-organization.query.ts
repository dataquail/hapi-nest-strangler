import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { SubscriptionId } from "../domain/subscription/subscription.id.js";

// The Stripe id columns stay off the view so consumers never couple to the gateway.
export type SubscriptionView = {
  readonly id: SubscriptionId;
  readonly organizationId: OrganizationId;
  readonly status: string;
  readonly currentPeriodEnd: Date | null;
};

export type FindSubscriptionByOrganizationPayload = { readonly organizationId: OrganizationId };

export type FindSubscriptionByOrganizationResult = Result<
  SubscriptionView | null,
  PersistenceUnavailable
>;

export class FindSubscriptionByOrganizationQuery extends Query<FindSubscriptionByOrganizationResult> {
  constructor(public readonly payload: FindSubscriptionByOrganizationPayload) {
    super();
  }
}
