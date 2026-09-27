import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { MembershipRoot } from "./membership.root.js";

const forUser = (userId: UserId): Specification<MembershipRoot> =>
  Spec.eq<MembershipRoot, "userId">("userId", userId);
const forOrganization = (organizationId: OrganizationId): Specification<MembershipRoot> =>
  Spec.eq<MembershipRoot, "organizationId">("organizationId", organizationId);

export const MembershipSpecifications = { forUser, forOrganization } as const;
