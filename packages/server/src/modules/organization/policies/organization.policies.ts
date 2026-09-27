import { Inject, Injectable } from "@nestjs/common";

import { Check, type CheckFor, type PolicyContribution } from "@/platform/auth/authz.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import { PlatformRoles } from "../domain/ports/acl/platform-roles.acl.js";
import { FindMembershipQuery } from "../queries/find-membership.policy-query.js";
import type { OrganizationAuthzView } from "../queries/find-organization-by-id.query.js";
import { FindUserOrganizationRolesQuery } from "../queries/find-user-organization-roles.policy-query.js";
import { makeIsMember, type UserOrganizationLookup } from "./is-member.policy.js";
import { makeIsOrgAdmin } from "./is-org-admin.policy.js";
import { makeIsOrgSuperAdmin } from "./is-org-super-admin.policy.js";

const ORG_ADMIN_ROLE = "admin";

declare module "@org/authz/resource-resolver-registry" {
  interface ResourceResolverMap {
    organization: { resourceType: OrganizationAuthzView; idType: OrganizationId };
  }
}

declare module "@org/authz/policy-registry" {
  interface PolicyMap {
    organization: {
      read: CheckFor<"organization">;
      update: CheckFor<"organization">;
      delete: CheckFor<"organization">;
    };
    organizationCollection: {
      read: CheckFor<"organizationCollection">;
    };
  }
}

export const OrganizationResource = "organization" as const;
export const OrganizationCollectionResource = "organizationCollection" as const;

// Own data comes from dispatching this module's own queries; foreign data
// (platform roles) from this module's own ACL port.
@Injectable()
export class OrganizationPolicyContribution {
  public readonly contribution: PolicyContribution;

  constructor(
    @Inject(PlatformRoles) roles: PlatformRoles,
    @Inject(AppQueryBus) queries: AppQueryBus,
  ) {
    const isMember: UserOrganizationLookup = async (userId, organizationId) =>
      (await queries.execute(new FindMembershipQuery({ userId, organizationId }))).map(
        (view) => view.isMember,
      );
    const isOrgAdmin: UserOrganizationLookup = async (userId, organizationId) =>
      (await queries.execute(new FindUserOrganizationRolesQuery({ userId, organizationId }))).map(
        (view) => view.roles.includes(ORG_ADMIN_ROLE),
      );
    const superAdmin = makeIsOrgSuperAdmin(roles);
    this.contribution = {
      organization: {
        read: Check.any(superAdmin, makeIsMember(isMember)),
        update: Check.any(superAdmin, makeIsOrgAdmin(isOrgAdmin)),
        delete: superAdmin,
      },
      organizationCollection: { read: superAdmin },
    };
  }
}
