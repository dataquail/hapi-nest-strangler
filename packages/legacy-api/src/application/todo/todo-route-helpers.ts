import Boom from "@hapi/boom";
import type { Request, ResponseToolkit } from "@hapi/hapi";

import { currentUser } from "../../lib/access/current-user";
import { asyncValidation } from "../../lib/hapi-async-validation";
import Joi = require("../../lib/joi");
import { problem } from "../../lib/problem";

// Membership for the collection routes, checked here because the ACL only
// sees a string resource for them. Super admins pass, as everywhere.
export const fromOwnOrganization = (request: Request, h: ResponseToolkit) => {
  const user = currentUser(request);
  const organization = (request.params as any).orgId;
  if (user.isSuperAdmin() || user.isMemberOf(organization.get("id"))) return h.continue;
  return Boom.forbidden();
};

// A todo reached through another organization's path reads as absent, never as a leak.
export const todoBelongsToOrganization =
  (notFoundTag: string) => (request: Request, h: ResponseToolkit) => {
    const { id: todo, orgId } = request.params as any;
    if (todo.get("organization_id") !== orgId.get("id")) {
      throw problem(404, notFoundTag, { message: `Todo with id ${todo.get("id")} not found` });
    }
    return h.continue;
  };

export const orgAndTodoParams = (rowExists: any, notFoundTag: string) =>
  asyncValidation(
    { orgId: Joi.string().uuid().required(), id: Joi.string().uuid().required() },
    {
      orgId: rowExists("organization", "id", "Organization not found", {
        tag: "OrganizationNotFoundError",
        fields: (organizationId: string) => ({
          organizationId,
          message: `Organization ${organizationId} not found`,
        }),
      }),
      id: rowExists("todo", "id", "Todo not found", {
        tag: notFoundTag,
        fields: (id: string) => ({ message: `Todo with id ${id} not found` }),
      }),
    },
  );

export const orgParams = (rowExists: any) =>
  asyncValidation(
    { orgId: Joi.string().uuid().required() },
    {
      orgId: rowExists("organization", "id", "Organization not found", {
        tag: "OrganizationNotFoundError",
        fields: (organizationId: string) => ({
          organizationId,
          message: `Organization ${organizationId} not found`,
        }),
      }),
    },
  );
