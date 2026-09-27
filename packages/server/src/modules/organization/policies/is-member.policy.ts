import type { Result } from "oxide.ts";

import type { ResourceCheck } from "@/platform/auth/authz.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { OrganizationAuthzView } from "../queries/find-organization-by-id.query.js";

export type UserOrganizationLookup = (
  userId: UserId,
  organizationId: OrganizationId,
) => Promise<Result<boolean, PersistenceUnavailable>>;

export const makeIsMember =
  (isMember: UserOrganizationLookup): ResourceCheck<OrganizationAuthzView> =>
  (caller, organization) =>
    isMember(caller.userId, organization.organizationId);
