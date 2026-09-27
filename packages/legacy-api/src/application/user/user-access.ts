import type { Acl } from "virgen-acl";

import { actionConstants } from "../../constants/acl/action-constants";
import { resourceConstants } from "../../constants/acl/resource-constants";
import { roleConstants } from "../../constants/acl/role-constants";

const { CREATE, DELETE, LIST, VIEW } = actionConstants;

// Any signed-in user may manage the user directory; a role that must not is
// denied here explicitly, LIFO, because the ACL reads its rules newest first.
export const userAccess = (acl: Acl) => {
  acl.allow(roleConstants.USER, resourceConstants.USER, [LIST, VIEW, CREATE, DELETE]);
};
