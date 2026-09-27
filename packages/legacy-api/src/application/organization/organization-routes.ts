import type { ServerRoute } from "@hapi/hapi";

import { actionConstants } from "../../constants/acl/action-constants";
import { resourceConstants } from "../../constants/acl/resource-constants";
import { can } from "../../lib/access/can";
import { currentUser } from "../../lib/access/current-user";
import { asyncValidation } from "../../lib/hapi-async-validation";
import Joi = require("../../lib/joi");
import { problem } from "../../lib/problem";
import type OrganizationService = require("./organization-service");

const { ORGANIZATION } = resourceConstants;
const DEFAULT_INVITATION_TTL_SECONDS = 60 * 60 * 24 * 7;

const organizationRoutes = (
  organizationService: OrganizationService,
  rowExists: any,
): ServerRoute[] => {
  const orgParam = (name: string) => ({
    [name]: rowExists("organization", "id", "Organization not found", {
      tag: "OrganizationNotFoundError",
      fields: (organizationId: string) => ({
        organizationId,
        message: `Organization ${organizationId} not found`,
      }),
    }),
  });
  const uuid = () => Joi.string().uuid().required();

  return [
    {
      method: "GET",
      path: "/orgs",
      handler: (request) => organizationService.findMine(currentUser(request).get("id")),
      options: { tags: ["api"], description: "The caller's organizations", auth: "session" },
    },
    {
      method: "POST",
      path: "/orgs",
      handler: async (request, h) => {
        const user = currentUser(request);
        // Platform admins administer organizations; they never own one.
        if (user.isSuperAdmin()) {
          throw problem(409, "SuperAdminCannotOwnOrganizationError", {
            message: "Super-admins don't own organizations.",
          });
        }
        const { name } = request.payload as { name: string };
        const id = await organizationService.createOrganization(name, user.get("id"));
        return h.response({ id }).code(201);
      },
      options: {
        tags: ["api"],
        description: "Create an organization owned by the caller",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.CREATE, ORGANIZATION) }] },
        validate: { payload: Joi.object({ name: Joi.string().min(1).max(255).required() }) },
      },
    },
    {
      method: "DELETE",
      path: "/orgs/{id}",
      handler: async (request, h) => {
        await organizationService.softDelete((request.params as any).id);
        return h.response().code(204);
      },
      options: {
        tags: ["api"],
        description: "Soft-delete an organization",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.DELETE, "params.id") }] },
        validate: { params: asyncValidation({ id: uuid() }, orgParam("id")) },
      },
    },
    {
      method: "POST",
      path: "/orgs/{id}/restore",
      handler: async (request, h) => {
        await organizationService.restore((request.params as any).id);
        return h.response().code(204);
      },
      options: {
        tags: ["api"],
        description: "Restore a soft-deleted organization",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.RESTORE, "params.id") }] },
        validate: { params: asyncValidation({ id: uuid() }, orgParam("id")) },
      },
    },
    {
      method: "POST",
      path: "/orgs/{orgId}/invitations",
      handler: async (request, h) => {
        const { email } = request.payload as { email: string };
        const invitationId = await organizationService.inviteUser(
          (request.params as any).orgId,
          email,
          DEFAULT_INVITATION_TTL_SECONDS,
        );
        return h.response({ invitationId }).code(201);
      },
      options: {
        tags: ["api"],
        description: "Invite an email address to the organization",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.EDIT, "params.orgId") }] },
        validate: {
          params: asyncValidation({ orgId: uuid() }, orgParam("orgId")),
          payload: Joi.object({ email: Joi.string().min(3).max(320).required() }),
        },
      },
    },
    {
      method: "GET",
      path: "/orgs/{orgId}/invitations",
      handler: async (request) => ({
        invitations: await organizationService.findPendingInvitations(
          (request.params as any).orgId,
        ),
      }),
      options: {
        tags: ["api"],
        description: "Open invitations of the organization",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.EDIT, "params.orgId") }] },
        validate: { params: asyncValidation({ orgId: uuid() }, orgParam("orgId")) },
      },
    },
    {
      method: "DELETE",
      path: "/orgs/{orgId}/invitations/{invitationId}",
      handler: async (request, h) => {
        const params = request.params as any;
        await organizationService.revokeInvitation(params.orgId, params.invitationId);
        return h.response().code(204);
      },
      options: {
        tags: ["api"],
        description: "Revoke an open invitation",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.EDIT, "params.orgId") }] },
        validate: {
          params: asyncValidation({ orgId: uuid(), invitationId: uuid() }, orgParam("orgId")),
        },
      },
    },
    {
      method: "POST",
      path: "/orgs/{orgId}/invitations/{invitationId}/resend",
      handler: async (request, h) => {
        const params = request.params as any;
        await organizationService.resendInvitation(
          params.orgId,
          params.invitationId,
          DEFAULT_INVITATION_TTL_SECONDS,
        );
        return h.response().code(204);
      },
      options: {
        tags: ["api"],
        description: "Reissue an open invitation with a fresh token",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.EDIT, "params.orgId") }] },
        validate: {
          params: asyncValidation({ orgId: uuid(), invitationId: uuid() }, orgParam("orgId")),
        },
      },
    },
    {
      method: "GET",
      path: "/orgs/{orgId}/members",
      handler: async (request) => ({
        members: await organizationService.findMembers((request.params as any).orgId),
      }),
      options: {
        tags: ["api"],
        description: "Members of the organization",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.VIEW, "params.orgId") }] },
        validate: { params: asyncValidation({ orgId: uuid() }, orgParam("orgId")) },
      },
    },
    {
      method: "DELETE",
      path: "/orgs/{orgId}/members/{userId}",
      handler: async (request, h) => {
        const params = request.params as any;
        await organizationService.removeMember(params.orgId, params.userId);
        return h.response().code(204);
      },
      options: {
        tags: ["api"],
        description: "Remove a member",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.EDIT, "params.orgId") }] },
        validate: { params: asyncValidation({ orgId: uuid(), userId: uuid() }, orgParam("orgId")) },
      },
    },
    {
      method: "POST",
      path: "/orgs/{orgId}/members/{userId}/admin",
      handler: async (request, h) => {
        const params = request.params as any;
        await organizationService.promoteMember(
          params.orgId,
          params.userId,
          currentUser(request).get("id"),
        );
        return h.response().code(204);
      },
      options: {
        tags: ["api"],
        description: "Make a member an admin",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.EDIT, "params.orgId") }] },
        validate: { params: asyncValidation({ orgId: uuid(), userId: uuid() }, orgParam("orgId")) },
      },
    },
    {
      method: "DELETE",
      path: "/orgs/{orgId}/members/{userId}/admin",
      handler: async (request, h) => {
        const params = request.params as any;
        await organizationService.demoteMember(params.orgId, params.userId);
        return h.response().code(204);
      },
      options: {
        tags: ["api"],
        description: "Take a member's admin role away",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.EDIT, "params.orgId") }] },
        validate: { params: asyncValidation({ orgId: uuid(), userId: uuid() }, orgParam("orgId")) },
      },
    },
    {
      method: "POST",
      path: "/orgs/{orgId}/leave",
      handler: async (request, h) => {
        await organizationService.leave(
          (request.params as any).orgId,
          currentUser(request).get("id"),
        );
        return h.response().code(204);
      },
      options: {
        tags: ["api"],
        description: "Leave the organization",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.LEAVE, ORGANIZATION) }] },
        validate: { params: Joi.object({ orgId: uuid() }) },
      },
    },
    {
      method: "GET",
      path: "/admin/orgs",
      handler: (request) => {
        const query = request.query as { page: number; pageSize: number; includeDeleted?: string };
        return organizationService.findAll(
          query.page,
          query.pageSize,
          query.includeDeleted === "true",
        );
      },
      options: {
        tags: ["api"],
        description: "Every organization, for platform admins",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.LIST_ADMIN, ORGANIZATION) }] },
        validate: {
          query: Joi.object({
            page: Joi.number().integer().min(1).required(),
            pageSize: Joi.number().integer().min(1).max(100).required(),
            includeDeleted: Joi.string().valid("true", "false"),
          }),
        },
      },
    },
    {
      method: "POST",
      path: "/invitations/{token}/accept",
      handler: async (request) => ({
        organizationId: await organizationService.acceptInvitation(
          (request.params as any).token,
          currentUser(request),
        ),
      }),
      options: {
        tags: ["api"],
        description: "Accept an invitation by its token",
        auth: "session",
        validate: { params: Joi.object({ token: Joi.string().required() }) },
      },
    },
  ];
};

organizationRoutes["@singleton"] = true;
organizationRoutes["@require"] = [
  "organization/organization-service",
  "hapi-async-validation/bookshelf/row-exists",
];

export = organizationRoutes;
