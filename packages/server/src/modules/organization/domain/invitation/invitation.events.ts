import { z } from "zod";

import * as Event from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/domain-event.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

export const InvitationIssued = Event.make("InvitationIssued", {
  invitationId: InvitationId,
  organizationId: OrganizationId,
  inviteeEmail: z.string(),
});
export type InvitationIssued = Event.Type<typeof InvitationIssued>;

export const invitationIssuedSpanAttributes: SpanAttributesExtractor<InvitationIssued> = (
  event,
) => ({
  "invitation.id": event.invitationId,
  "organization.id": event.organizationId,
});

export const InvitationAccepted = Event.make("InvitationAccepted", {
  invitationId: InvitationId,
  organizationId: OrganizationId,
  userId: UserId,
});
export type InvitationAccepted = Event.Type<typeof InvitationAccepted>;

export const invitationAcceptedSpanAttributes: SpanAttributesExtractor<InvitationAccepted> = (
  event,
) => ({
  "invitation.id": event.invitationId,
  "organization.id": event.organizationId,
  "user.id": event.userId,
});

export const InvitationRevoked = Event.make("InvitationRevoked", {
  invitationId: InvitationId,
  organizationId: OrganizationId,
});
export type InvitationRevoked = Event.Type<typeof InvitationRevoked>;

export const invitationRevokedSpanAttributes: SpanAttributesExtractor<InvitationRevoked> = (
  event,
) => ({
  "invitation.id": event.invitationId,
  "organization.id": event.organizationId,
});

export const InvitationReissued = Event.make("InvitationReissued", {
  invitationId: InvitationId,
  organizationId: OrganizationId,
  inviteeEmail: z.string(),
});
export type InvitationReissued = Event.Type<typeof InvitationReissued>;

export const invitationReissuedSpanAttributes: SpanAttributesExtractor<InvitationReissued> = (
  event,
) => ({
  "invitation.id": event.invitationId,
  "organization.id": event.organizationId,
});

export type InvitationEvent =
  InvitationIssued | InvitationAccepted | InvitationRevoked | InvitationReissued;
