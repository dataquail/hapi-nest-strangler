import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

export class SubscriptionNotFound extends TaggedError("SubscriptionNotFound")<{
  readonly organizationId: OrganizationId;
}> {}

export class SubscriptionAlreadyExistsForOrganization extends TaggedError(
  "SubscriptionAlreadyExistsForOrganization",
)<{ readonly organizationId: OrganizationId }> {}

// The external provider failed; a 502 at the boundary, distinct from our own
// store being down so an oncall sees which dependency failed.
export class BillingGatewayUnavailable extends TaggedError("BillingGatewayUnavailable")<{
  readonly message: string;
}> {}

export class InvalidWebhookSignature extends TaggedError("InvalidWebhookSignature")<{
  readonly message: string;
}> {}
