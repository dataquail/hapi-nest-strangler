import type { Acl } from "virgen-acl";

import { actionConstants } from "../../constants/acl/action-constants";
import { resourceConstants } from "../../constants/acl/resource-constants";
import { roleConstants } from "../../constants/acl/role-constants";

const { CREATE, DELETE, EDIT, LIST } = actionConstants;
const { TODO } = resourceConstants;

// A todo row carries its organization; a member of that organization may
// touch it. The collection routes have no row to hand the ACL, so their
// membership check lives in the route file instead.
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

export const todoAccess = (acl: Acl) => {
  acl.allow(roleConstants.USER, TODO, [LIST, CREATE]);
  acl.allow(roleConstants.USER, TODO, [EDIT, DELETE], fromTodoOrganization as any);
};
