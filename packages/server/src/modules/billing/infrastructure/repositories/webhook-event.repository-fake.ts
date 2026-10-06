import { Err, Ok, type Result } from "oxide.ts";

import { WebhookEventAlreadyRecorded } from "@/modules/billing/domain/webhook-event/webhook-event.errors.js";
import {
  type WebhookEventRecord,
  WebhookEventRepository,
} from "@/modules/billing/domain/webhook-event/webhook-event.repository.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

export class WebhookEventRepositoryFake extends WebhookEventRepository {
  private readonly store = new Map<string, WebhookEventRecord>();

  public insertOne(
    stripeEventId: string,
  ): Promise<Result<void, WebhookEventAlreadyRecorded | PersistenceUnavailable>> {
    if (this.store.has(stripeEventId))
      return Promise.resolve(Err(new WebhookEventAlreadyRecorded({ stripeEventId })));
    this.store.set(stripeEventId, { stripeEventId, receivedAt: new Date() });
    return Promise.resolve(Ok(undefined));
  }

  public findOne(
    spec: Specification<WebhookEventRecord>,
  ): Promise<Result<WebhookEventRecord | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].find(spec) ?? null));
  }
}
