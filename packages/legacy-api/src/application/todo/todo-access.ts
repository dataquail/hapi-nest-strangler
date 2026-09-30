import Boom from "@hapi/boom";
import type { Request, ResponseToolkit } from "@hapi/hapi";
import type { Acl } from "virgen-acl";

import { actionConstants } from "../../constants/acl/action-constants";
import { resourceConstants } from "../../constants/acl/resource-constants";
import { roleConstants } from "../../constants/acl/role-constants";
import { currentUser } from "../../lib/access/current-user";

const { CREATE, DELETE, EDIT, LIST } = actionConstants;
const { TODO } = resourceConstants;

// A todo row carries its organization; a member of that organization may
// touch it.
export const fromTodoOrganization = function (
  err: Error | undefined,
  user: any,
  resource: any,
  _action: string,
  result: (error?: Error, allowed?: boolean) => void,
  next: () => void,
) {
  if (err) throw err;
  if (!resource || typeof resource.get !== "function") {
    next();
    return;
  }
  if (user.isMemberOf(resource.get("organization_id"))) {
    result(undefined, true);
    return;
  }
  next();
};

// Membership for the collection routes, as a pre-handler because the ACL only
// sees a string resource for them. Super admins pass, as everywhere.
export const fromOwnOrganization = (request: Request, h: ResponseToolkit) => {
  const user = currentUser(request);
  const organization = (request.params as any).orgId;
  if (user.isSuperAdmin() || user.isMemberOf(organization.get("id"))) return h.continue;
  return Boom.forbidden();
};

export const todoAccess = (acl: Acl) => {
  acl.allow(roleConstants.USER, TODO, [LIST, CREATE]);
  acl.allow(roleConstants.USER, TODO, [EDIT, DELETE], fromTodoOrganization as any);
};
