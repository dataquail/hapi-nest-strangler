import { z } from "zod";

import { InvitationId, OrganizationId, UserId } from "../EntityIds.js";
import { defineError, Forbidden, ServiceUnavailable } from "../HttpErrors.js";
import { defineGroup, defineRoute } from "../Route.js";

export const OrganizationNotFoundError = defineError(
  "OrganizationNotFoundError",
  404,
  { organizationId: OrganizationId, message: z.string() },
  "No organization with that id",
);

export const OrganizationNotDeletedError = defineError(
  "OrganizationNotDeletedError",
  409,
  { organizationId: OrganizationId, message: z.string() },
  "The organization is not deleted, so it cannot be restored",
);

export const InvitationNotFoundError = defineError(
  "InvitationNotFoundError",
  404,
  { message: z.string() },
  "No invitation matches",
);

export const InvitationGoneError = defineError(
  "InvitationGoneError",
  410,
  { reason: z.enum(["accepted", "revoked", "expired"]), message: z.string() },
  "The invitation can no longer be acted on",
);

export const MembershipNotFoundError = defineError(
  "MembershipNotFoundError",
  404,
  { message: z.string() },
  "The user is not a member of the organization",
);

export const OrganizationRoleConflictError = defineError(
  "OrganizationRoleConflictError",
  409,
  { reason: z.enum(["already_admin", "not_admin"]), message: z.string() },
  "The member already holds, or does not hold, that role",
);

export const SuperAdminCannotOwnOrganizationError = defineError(
  "SuperAdminCannotOwnOrganizationError",
  409,
  { message: z.string() },
  "A super-admin cannot own or join an organization",
);

export const Organization = z
  .object({
    id: OrganizationId,
    name: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    deletedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "Organization" });
export type Organization = z.infer<typeof Organization>;

export const MyOrganization = z
  .object({
    id: OrganizationId,
    name: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    deletedAt: z.iso.datetime().nullable(),
    isAdmin: z.boolean(),
  })
  .meta({ id: "MyOrganization" });
export type MyOrganization = z.infer<typeof MyOrganization>;

export const CreateOrganizationPayload = z
  .object({ name: z.string().min(1).max(255) })
  .meta({ id: "CreateOrganizationPayload" });
export type CreateOrganizationPayload = z.infer<typeof CreateOrganizationPayload>;

export const CreateOrganizationResponse = z
  .object({ id: OrganizationId })
  .meta({ id: "CreateOrganizationResponse" });
export type CreateOrganizationResponse = z.infer<typeof CreateOrganizationResponse>;

export const FindAllOrganizationsParams = z
  .object({
    page: z.coerce.number().int().min(1),
    pageSize: z.coerce.number().int().min(1).max(100),
    includeDeleted: z.enum(["true", "false"]).optional(),
  })
  .meta({ id: "FindAllOrganizationsParams" });
export type FindAllOrganizationsParams = z.infer<typeof FindAllOrganizationsParams>;

export const PaginatedOrganizations = z
  .object({
    organizations: z.array(Organization),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
  })
  .meta({ id: "PaginatedOrganizations" });
export type PaginatedOrganizations = z.infer<typeof PaginatedOrganizations>;

export const InviteUserPayload = z
  .object({ email: z.string().min(3).max(320) })
  .meta({ id: "InviteUserPayload" });
export type InviteUserPayload = z.infer<typeof InviteUserPayload>;

export const InviteUserResponse = z
  .object({ invitationId: InvitationId })
  .meta({ id: "InviteUserResponse" });
export type InviteUserResponse = z.infer<typeof InviteUserResponse>;

export const AcceptInvitationResponse = z
  .object({ organizationId: OrganizationId })
  .meta({ id: "AcceptInvitationResponse" });
export type AcceptInvitationResponse = z.infer<typeof AcceptInvitationResponse>;

export const OrganizationMember = z
  .object({
    userId: UserId,
    email: z.string(),
    joinedAt: z.iso.datetime(),
    isAdmin: z.boolean(),
  })
  .meta({ id: "OrganizationMember" });
export type OrganizationMember = z.infer<typeof OrganizationMember>;

export const OrganizationMembersResponse = z
  .object({ members: z.array(OrganizationMember) })
  .meta({ id: "OrganizationMembersResponse" });
export type OrganizationMembersResponse = z.infer<typeof OrganizationMembersResponse>;

export const PendingInvitation = z
  .object({
    invitationId: InvitationId,
    inviteeEmail: z.string(),
    status: z.enum(["pending", "expired"]),
    expiresAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "PendingInvitation" });
export type PendingInvitation = z.infer<typeof PendingInvitation>;

export const PendingInvitationsResponse = z
  .object({ invitations: z.array(PendingInvitation) })
  .meta({ id: "PendingInvitationsResponse" });
export type PendingInvitationsResponse = z.infer<typeof PendingInvitationsResponse>;

const OrgParams = z.object({ orgId: OrganizationId });
const OrgInvitationParams = z.object({ orgId: OrganizationId, invitationId: InvitationId });
const OrgMemberParams = z.object({ orgId: OrganizationId, userId: UserId });

export const Group = defineGroup({
  name: "organization",
  routes: {
    findMine: defineRoute({
      method: "get",
      path: "/orgs",
      operationId: "organization.findMine",
      success: { status: 200, schema: z.array(MyOrganization) },
      errors: [ServiceUnavailable],
      security: "session",
    }),
    create: defineRoute({
      method: "post",
      path: "/orgs",
      operationId: "organization.create",
      body: CreateOrganizationPayload,
      success: { status: 201, schema: CreateOrganizationResponse },
      errors: [SuperAdminCannotOwnOrganizationError, ServiceUnavailable],
      security: "session",
    }),
    softDelete: defineRoute({
      method: "delete",
      path: "/orgs/{id}",
      operationId: "organization.softDelete",
      params: z.object({ id: OrganizationId }),
      success: { status: 204, schema: undefined },
      errors: [Forbidden, OrganizationNotFoundError, ServiceUnavailable],
      security: "session",
    }),
    restore: defineRoute({
      method: "post",
      path: "/orgs/{id}/restore",
      operationId: "organization.restore",
      params: z.object({ id: OrganizationId }),
      success: { status: 204, schema: undefined },
      errors: [
        Forbidden,
        OrganizationNotFoundError,
        OrganizationNotDeletedError,
        ServiceUnavailable,
      ],
      security: "session",
    }),
    inviteUser: defineRoute({
      method: "post",
      path: "/orgs/{orgId}/invitations",
      operationId: "organization.inviteUser",
      params: OrgParams,
      body: InviteUserPayload,
      success: { status: 201, schema: InviteUserResponse },
      errors: [Forbidden, OrganizationNotFoundError, ServiceUnavailable],
      security: "session",
    }),
    revokeInvitation: defineRoute({
      method: "delete",
      path: "/orgs/{orgId}/invitations/{invitationId}",
      operationId: "organization.revokeInvitation",
      params: OrgInvitationParams,
      success: { status: 204, schema: undefined },
      errors: [
        Forbidden,
        OrganizationNotFoundError,
        InvitationNotFoundError,
        InvitationGoneError,
        ServiceUnavailable,
      ],
      security: "session",
    }),
    findInvitations: defineRoute({
      method: "get",
      path: "/orgs/{orgId}/invitations",
      operationId: "organization.findInvitations",
      params: OrgParams,
      success: { status: 200, schema: PendingInvitationsResponse },
      errors: [Forbidden, OrganizationNotFoundError, ServiceUnavailable],
      security: "session",
    }),
    resendInvitation: defineRoute({
      method: "post",
      path: "/orgs/{orgId}/invitations/{invitationId}/resend",
      operationId: "organization.resendInvitation",
      params: OrgInvitationParams,
      success: { status: 204, schema: undefined },
      errors: [
        Forbidden,
        OrganizationNotFoundError,
        InvitationNotFoundError,
        InvitationGoneError,
        ServiceUnavailable,
      ],
      security: "session",
    }),
    removeMember: defineRoute({
      method: "delete",
      path: "/orgs/{orgId}/members/{userId}",
      operationId: "organization.removeMember",
      params: OrgMemberParams,
      success: { status: 204, schema: undefined },
      errors: [Forbidden, OrganizationNotFoundError, MembershipNotFoundError, ServiceUnavailable],
      security: "session",
    }),
    findMembers: defineRoute({
      method: "get",
      path: "/orgs/{orgId}/members",
      operationId: "organization.findMembers",
      params: OrgParams,
      success: { status: 200, schema: OrganizationMembersResponse },
      errors: [Forbidden, OrganizationNotFoundError, ServiceUnavailable],
      security: "session",
    }),
    promoteMember: defineRoute({
      method: "post",
      path: "/orgs/{orgId}/members/{userId}/admin",
      operationId: "organization.promoteMember",
      params: OrgMemberParams,
      success: { status: 204, schema: undefined },
      errors: [
        Forbidden,
        OrganizationNotFoundError,
        OrganizationRoleConflictError,
        ServiceUnavailable,
      ],
      security: "session",
    }),
    demoteMember: defineRoute({
      method: "delete",
      path: "/orgs/{orgId}/members/{userId}/admin",
      operationId: "organization.demoteMember",
      params: OrgMemberParams,
      success: { status: 204, schema: undefined },
      errors: [
        Forbidden,
        OrganizationNotFoundError,
        OrganizationRoleConflictError,
        ServiceUnavailable,
      ],
      security: "session",
    }),
    leave: defineRoute({
      method: "post",
      path: "/orgs/{orgId}/leave",
      operationId: "organization.leave",
      params: OrgParams,
      success: { status: 204, schema: undefined },
      errors: [MembershipNotFoundError, ServiceUnavailable],
      security: "session",
    }),
  },
});

export const AdminGroup = defineGroup({
  name: "organizationAdmin",
  routes: {
    findAll: defineRoute({
      method: "get",
      path: "/admin/orgs",
      operationId: "organizationAdmin.findAll",
      query: FindAllOrganizationsParams,
      success: { status: 200, schema: PaginatedOrganizations },
      errors: [Forbidden, ServiceUnavailable],
      security: "session",
    }),
  },
});

export const InvitationGroup = defineGroup({
  name: "invitations",
  routes: {
    accept: defineRoute({
      method: "post",
      path: "/invitations/{token}/accept",
      operationId: "invitations.accept",
      params: z.object({ token: z.string() }),
      success: { status: 200, schema: AcceptInvitationResponse },
      errors: [
        InvitationNotFoundError,
        InvitationGoneError,
        SuperAdminCannotOwnOrganizationError,
        ServiceUnavailable,
      ],
      security: "session",
    }),
  },
});
