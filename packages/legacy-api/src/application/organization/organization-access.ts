import type { Acl } from "virgen-acl";

import { actionConstants } from "../../constants/acl/action-constants";
import { resourceConstants } from "../../constants/acl/resource-constants";
import { roleConstants } from "../../constants/acl/role-constants";
import { asOrganizationAdmin, fromOwnOrganization } from "../../lib/access/organization-assertions";

const { CREATE, EDIT, LEAVE, VIEW } = actionConstants;
const { ORGANIZATION } = resourceConstants;

export const organizationAccess = (acl: Acl) => {
  // Anyone signed in may open an organization; the route refuses super admins itself.
  acl.allow(roleConstants.USER, ORGANIZATION, [CREATE, LEAVE]);
  // virgen-acl types `next` as Function; the assertions are typed for what it passes.
  acl.allow(roleConstants.USER, ORGANIZATION, [VIEW], fromOwnOrganization as any);
  acl.allow(roleConstants.USER, ORGANIZATION, [EDIT], asOrganizationAdmin as any);
  // DELETE, RESTORE and LIST_ADMIN have no USER rule: only the global super-admin allow reaches them.
};
