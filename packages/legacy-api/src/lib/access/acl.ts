import { Acl } from "virgen-acl";

import { organizationAccess } from "../../application/organization/organization-access";
import { userAccess } from "../../application/user/user-access";
import { roleConstants } from "../../constants/acl/role-constants";
import { roleResourceInit } from "../../constants/acl/role-resource-init";

const acl = new Acl();
roleResourceInit(acl);

acl.deny(); // deny all by default
acl.allow(roleConstants.SUPER_ADMIN); // super admins can do anything

userAccess(acl);
organizationAccess(acl);

export = acl;
