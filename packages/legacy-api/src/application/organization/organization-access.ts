import type { Acl } from "virgen-acl";

import { actionConstants } from "../../constants/acl/action-constants";
import { resourceConstants } from "../../constants/acl/resource-constants";
import { roleConstants } from "../../constants/acl/role-constants";

const { CREATE, EDIT, LEAVE, VIEW } = actionConstants;
const { ORGANIZATION } = resourceConstants;

// Assertions read the memberships and organization roles the session strategy
// preloads on the user, so no query runs here. A miss falls through with
// `next()` rather than denying: a super admin carries USER too, and the global
// super-admin allow sits below every module rule.
export const fromOwnOrganization = function (
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
  if (user.isMemberOf(resource.get("id"))) {
    result(undefined, true);
    return;
  }
  next();
};

export const asOrganizationAdmin = function (
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
  if (user.isAdminOf(resource.get("id"))) {
    result(undefined, true);
    return;
  }
  next();
};

export const organizationAccess = (acl: Acl) => {
  // Anyone signed in may open an organization; the route refuses super admins itself.
  acl.allow(roleConstants.USER, ORGANIZATION, [CREATE, LEAVE]);
  // virgen-acl types `next` as Function; the assertions are typed for what it passes.
  acl.allow(roleConstants.USER, ORGANIZATION, [VIEW], fromOwnOrganization as any);
  acl.allow(roleConstants.USER, ORGANIZATION, [EDIT], asOrganizationAdmin as any);
  // DELETE, RESTORE and LIST_ADMIN have no USER rule: only the global super-admin allow reaches them.
};
