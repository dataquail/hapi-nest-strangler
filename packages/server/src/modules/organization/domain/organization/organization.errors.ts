import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

export class OrganizationNotFound extends TaggedError("OrganizationNotFound")<{
  readonly organizationId: OrganizationId;
}> {}

export class OrganizationAlreadyDeleted extends TaggedError("OrganizationAlreadyDeleted")<{
  readonly organizationId: OrganizationId;
}> {}

export class OrganizationNotDeleted extends TaggedError("OrganizationNotDeleted")<{
  readonly organizationId: OrganizationId;
}> {}

export class SuperAdminCannotOwnOrganization extends TaggedError(
  "SuperAdminCannotOwnOrganization",
)<{
  readonly userId: UserId;
}> {}
