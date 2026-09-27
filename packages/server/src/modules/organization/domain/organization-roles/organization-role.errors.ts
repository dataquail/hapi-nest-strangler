import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { OrganizationRoleValueObject } from "./organization-role.value-object.js";

export class AlreadyHasOrganizationRole extends TaggedError("AlreadyHasOrganizationRole")<{
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly role: OrganizationRoleValueObject;
}> {}

export class DoesNotHaveOrganizationRole extends TaggedError("DoesNotHaveOrganizationRole")<{
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly role: OrganizationRoleValueObject;
}> {}

export class CannotPromoteSelfInOrganization extends TaggedError(
  "CannotPromoteSelfInOrganization",
)<{
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
}> {}
