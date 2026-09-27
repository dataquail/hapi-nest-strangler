import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { OrganizationRoot } from "./organization.root.js";

const withId = (id: OrganizationId): Specification<OrganizationRoot> =>
  Spec.eq<OrganizationRoot, "id">("id", id);

const isDeleted = Spec.isNotNull<OrganizationRoot>("deletedAt");
const notDeleted = Spec.isNull<OrganizationRoot>("deletedAt");

export const OrganizationSpecifications = { withId, isDeleted, notDeleted } as const;
