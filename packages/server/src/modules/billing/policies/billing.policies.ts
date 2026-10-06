import { Inject, Injectable } from "@nestjs/common";

import { Check, type CheckFor, type PolicyContribution } from "@/platform/auth/authz.js";

import { OrganizationAccess } from "../domain/ports/acl/organization-access.acl.js";
import { PlatformRoles } from "../domain/ports/acl/platform-roles.acl.js";
import { makeIsBillingOrgAdmin } from "./is-billing-org-admin.policy.js";
import { makeIsBillingOrgMember } from "./is-billing-org-member.policy.js";
import { makeIsBillingSuperAdmin } from "./is-billing-super-admin.policy.js";

// `read` (GET) for every member; `update` (subscribe, cancel) for org admins
// only. Super admins bypass both. The webhook has no policy: its
// authentication is the signature.
declare module "@org/authz/policy-registry" {
  interface PolicyMap {
    billing: {
      read: CheckFor<"billing">;
      update: CheckFor<"billing">;
    };
  }
}

export const BillingResource = "billing" as const;

@Injectable()
export class BillingPolicyContribution {
  public readonly contribution: PolicyContribution;

  constructor(
    @Inject(PlatformRoles) roles: PlatformRoles,
    @Inject(OrganizationAccess) organizations: OrganizationAccess,
  ) {
    const superAdmin = makeIsBillingSuperAdmin(roles);
    this.contribution = {
      billing: {
        read: Check.any(superAdmin, makeIsBillingOrgMember(organizations)),
        update: Check.any(superAdmin, makeIsBillingOrgAdmin(organizations)),
      },
    };
  }
}
