import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import type { Result } from "oxide.ts";

import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription/subscription.errors.js";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.js";
import type { SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as SubscriptionMapper from "./subscription.mapper.js";

const timestampOrNull = (value: Date | null) => (value === null ? null : sql.timestamp(value));

@Injectable()
export class SubscriptionRepositoryLive extends SubscriptionRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  public insertOne(
    subscription: SubscriptionRoot,
  ): Promise<Result<void, SubscriptionAlreadyExistsForOrganization | PersistenceUnavailable>> {
    return translateDatabaseErrors(
      async () => {
        await this.db.exec(sql.unsafe`
          INSERT INTO billing.subscriptions
            (id, organization_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, created_at, updated_at)
          VALUES (${subscription.id}, ${subscription.organizationId}, ${subscription.stripeCustomerId},
                  ${subscription.stripeSubscriptionId}, ${subscription.status}, ${timestampOrNull(subscription.currentPeriodEnd)},
                  ${sql.timestamp(subscription.createdAt)}, ${sql.timestamp(subscription.updatedAt)})
        `);
      },
      (error) =>
        error.type === "unique_violation"
          ? new SubscriptionAlreadyExistsForOrganization({
              organizationId: subscription.organizationId,
            })
          : null,
    );
  }

  public updateOne(subscription: SubscriptionRoot): Promise<Result<void, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      await this.db.exec(sql.unsafe`
        UPDATE billing.subscriptions
        SET status = ${subscription.status},
            current_period_end = ${timestampOrNull(subscription.currentPeriodEnd)},
            updated_at = ${sql.timestamp(subscription.updatedAt)}
        WHERE id = ${subscription.id}
      `);
    });
  }

  // LIMIT 1 is safe: every spec used here selects on a unique column.
  public findOne(
    spec: Specification<SubscriptionRoot>,
  ): Promise<Result<SubscriptionRoot | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.SubscriptionRow)`
        SELECT * FROM billing.subscriptions
        WHERE ${criteriaToWhere(spec.criteria, SubscriptionMapper.columns)}
        LIMIT 1
      `);
      return row === null ? null : SubscriptionMapper.toDomain(row);
    });
  }
}
