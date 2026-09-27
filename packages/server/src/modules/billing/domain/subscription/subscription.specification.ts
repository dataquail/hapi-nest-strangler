import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { SubscriptionRoot } from "./subscription.root.js";

const forOrganization = (organizationId: OrganizationId): Specification<SubscriptionRoot> =>
  Spec.eq<SubscriptionRoot, "organizationId">("organizationId", organizationId);

const withStripeSubscriptionId = (stripeSubscriptionId: string): Specification<SubscriptionRoot> =>
  Spec.eq<SubscriptionRoot, "stripeSubscriptionId">("stripeSubscriptionId", stripeSubscriptionId);

export const SubscriptionSpecifications = { forOrganization, withStripeSubscriptionId } as const;
