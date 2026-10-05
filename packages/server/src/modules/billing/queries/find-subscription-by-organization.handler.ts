import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { RowSchemas, sql } from "@org/database";

import { Database } from "@/platform/database/database.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import { SubscriptionId } from "../domain/subscription/subscription.id.js";
import {
  FindSubscriptionByOrganizationQuery,
  type FindSubscriptionByOrganizationResult,
  type SubscriptionView,
} from "./find-subscription-by-organization.query.js";

const toView = (row: RowSchemas.SubscriptionRow): SubscriptionView => ({
  id: SubscriptionId.parse(row.id),
  organizationId: OrganizationId.parse(row.organization_id),
  status: row.status,
  currentPeriodEnd: row.current_period_end,
});

@QueryHandler(FindSubscriptionByOrganizationQuery)
export class FindSubscriptionByOrganizationHandler implements IQueryHandler<FindSubscriptionByOrganizationQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({
    payload,
  }: FindSubscriptionByOrganizationQuery): Promise<FindSubscriptionByOrganizationResult> {
    return translateDatabaseErrors(async () => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.SubscriptionRow)`
        SELECT * FROM billing.subscriptions WHERE organization_id = ${payload.organizationId}
      `);
      return row === null ? null : toView(row);
    });
  }
}
