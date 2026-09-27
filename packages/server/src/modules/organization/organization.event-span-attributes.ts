import type { SpanAttributes } from "@/platform/ddd/contracts/domain-event.js";

import {
  invitationAcceptedSpanAttributes,
  invitationIssuedSpanAttributes,
  invitationReissuedSpanAttributes,
  invitationRevokedSpanAttributes,
} from "./domain/invitation/invitation.events.js";
import {
  membershipCreatedSpanAttributes,
  membershipRevokedSpanAttributes,
} from "./domain/membership/membership.events.js";
import {
  organizationCreatedSpanAttributes,
  organizationRestoredSpanAttributes,
  organizationSoftDeletedSpanAttributes,
} from "./domain/organization/organization.events.js";
import {
  organizationRoleGrantedSpanAttributes,
  organizationRoleRevokedSpanAttributes,
} from "./domain/organization-roles/organization-role.events.js";

export const organizationEventSpanAttributes: SpanAttributes = {
  OrganizationCreated: organizationCreatedSpanAttributes,
  OrganizationSoftDeleted: organizationSoftDeletedSpanAttributes,
  OrganizationRestored: organizationRestoredSpanAttributes,
  MembershipCreated: membershipCreatedSpanAttributes,
  MembershipRevoked: membershipRevokedSpanAttributes,
  InvitationIssued: invitationIssuedSpanAttributes,
  InvitationAccepted: invitationAcceptedSpanAttributes,
  InvitationRevoked: invitationRevokedSpanAttributes,
  InvitationReissued: invitationReissuedSpanAttributes,
  OrganizationRoleGranted: organizationRoleGrantedSpanAttributes,
  OrganizationRoleRevoked: organizationRoleRevokedSpanAttributes,
};
