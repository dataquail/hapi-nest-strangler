import type { Acl } from "virgen-acl";

import { actionConstants } from "../../constants/acl/action-constants";
import { resourceConstants } from "../../constants/acl/resource-constants";
import { roleConstants } from "../../constants/acl/role-constants";
import { asOrganizationAdmin } from "../organization/organization-access";

const { MANAGE_BILLING } = actionConstants;

// Billing hangs its one action off the organization resource: reading the
// subscription is the organization's VIEW, committing the organization's money
// is MANAGE_BILLING, for its admins.
export const billingAccess = (acl: Acl) => {
  acl.allow(
    roleConstants.USER,
    resourceConstants.ORGANIZATION,
    [MANAGE_BILLING],
    asOrganizationAdmin as any,
  );
};
