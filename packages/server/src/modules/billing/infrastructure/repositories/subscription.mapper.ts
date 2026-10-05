import type { RowSchemas } from "@org/database";

import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import { SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import type { ColumnMap } from "@/platform/persistence/criteria-to-sql.js";

export const columns = {
  organizationId: "organization_id",
  stripeSubscriptionId: "stripe_subscription_id",
} as const satisfies Partial<Record<keyof SubscriptionRoot, string>> & ColumnMap;

export const toDomain = (row: RowSchemas.SubscriptionRow): SubscriptionRoot =>
  SubscriptionRoot.parse({
    id: SubscriptionId.parse(row.id),
    organizationId: OrganizationId.parse(row.organization_id),
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
