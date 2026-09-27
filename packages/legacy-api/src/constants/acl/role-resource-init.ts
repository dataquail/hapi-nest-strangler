import type { Acl } from "virgen-acl";

import { resourceConstants } from "./resource-constants";
import { roleConstants } from "./role-constants";

// Roles inherit downward through USER so a rule granted to every signed-in
// user reaches an admin too; resources are flat.
export const roleResourceInit = (acl: Acl) => {
  acl.addRole(roleConstants.USER);
  acl.addRole(roleConstants.SUPER_ADMIN, roleConstants.USER);
  acl.addRole(roleConstants.ORG_MEMBER, roleConstants.USER);
  acl.addRole(roleConstants.ORG_ADMIN, roleConstants.ORG_MEMBER);

  Object.values(resourceConstants).forEach((resource) => {
    acl.addResource(resource);
  });
};
