import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import type { Result } from "oxide.ts";

import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event/webhook-event.errors.js";
import {
  type WebhookEventRecord,
  WebhookEventRepository,
} from "@/modules/billing/domain/webhook-event/webhook-event.repository.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as WebhookEventMapper from "./webhook-event.mapper.js";

@Injectable()
export class WebhookEventRepositoryLive extends WebhookEventRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  // Race-free claim: the unique-key violation is the idempotency signal.
  public insertOne(
    stripeEventId: string,
  ): Promise<Result<void, WebhookEventAlreadyRecorded | PersistenceUnavailable>> {
    return translateDatabaseErrors(
      async () => {
        await this.db.exec(
          sql.unsafe`INSERT INTO billing.webhook_events (stripe_event_id) VALUES (${stripeEventId})`,
        );
      },
      (error) =>
        error.type === "unique_violation"
          ? new WebhookEventAlreadyRecorded({ stripeEventId })
          : null,
    );
  }

  public findOne(
    spec: Specification<WebhookEventRecord>,
  ): Promise<Result<WebhookEventRecord | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.WebhookEventRow)`
        SELECT * FROM billing.webhook_events
        WHERE ${criteriaToWhere(spec.criteria, WebhookEventMapper.columns)}
        LIMIT 1
      `);
      return row === null ? null : WebhookEventMapper.toDomain(row);
    });
  }
}
