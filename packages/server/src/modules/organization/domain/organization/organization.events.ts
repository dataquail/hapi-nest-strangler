import { z } from "zod";

import * as Event from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/domain-event.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

export const OrganizationCreated = Event.make("OrganizationCreated", {
  organizationId: OrganizationId,
  name: z.string(),
});
export type OrganizationCreated = Event.Type<typeof OrganizationCreated>;

export const organizationCreatedSpanAttributes: SpanAttributesExtractor<OrganizationCreated> = (
  event,
) => ({ "organization.id": event.organizationId });

export const OrganizationSoftDeleted = Event.make("OrganizationSoftDeleted", {
  organizationId: OrganizationId,
});
export type OrganizationSoftDeleted = Event.Type<typeof OrganizationSoftDeleted>;

export const organizationSoftDeletedSpanAttributes: SpanAttributesExtractor<
  OrganizationSoftDeleted
> = (event) => ({ "organization.id": event.organizationId });

export const OrganizationRestored = Event.make("OrganizationRestored", {
  organizationId: OrganizationId,
});
export type OrganizationRestored = Event.Type<typeof OrganizationRestored>;

export const organizationRestoredSpanAttributes: SpanAttributesExtractor<OrganizationRestored> = (
  event,
) => ({ "organization.id": event.organizationId });

export type OrganizationEvent =
  OrganizationCreated | OrganizationSoftDeleted | OrganizationRestored;
