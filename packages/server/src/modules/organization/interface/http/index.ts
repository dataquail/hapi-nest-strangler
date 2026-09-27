import { AcceptInvitationEndpoint } from "./accept-invitation.endpoint.js";
import { CreateOrganizationEndpoint } from "./create.endpoint.js";
import { DemoteMemberEndpoint } from "./demote-member.endpoint.js";
import { FindAllOrganizationsEndpoint } from "./find-all.endpoint.js";
import { FindInvitationsEndpoint } from "./find-invitations.endpoint.js";
import { FindMembersEndpoint } from "./find-members.endpoint.js";
import { FindMyOrganizationsEndpoint } from "./find-mine.endpoint.js";
import { InviteUserEndpoint } from "./invite.endpoint.js";
import { LeaveOrganizationEndpoint } from "./leave.endpoint.js";
import { PromoteMemberEndpoint } from "./promote-member.endpoint.js";
import { RemoveMemberEndpoint } from "./remove-member.endpoint.js";
import { ResendInvitationEndpoint } from "./resend-invitation.endpoint.js";
import { RestoreOrganizationEndpoint } from "./restore.endpoint.js";
import { RevokeInvitationEndpoint } from "./revoke-invitation.endpoint.js";
import { SoftDeleteOrganizationEndpoint } from "./soft-delete.endpoint.js";

export const organizationEndpoints = [
  FindMyOrganizationsEndpoint,
  CreateOrganizationEndpoint,
  SoftDeleteOrganizationEndpoint,
  RestoreOrganizationEndpoint,
  InviteUserEndpoint,
  RevokeInvitationEndpoint,
  ResendInvitationEndpoint,
  FindInvitationsEndpoint,
  RemoveMemberEndpoint,
  FindMembersEndpoint,
  PromoteMemberEndpoint,
  DemoteMemberEndpoint,
  LeaveOrganizationEndpoint,
  FindAllOrganizationsEndpoint,
  AcceptInvitationEndpoint,
] as const;
