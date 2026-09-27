import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

export class MembershipNotFound extends TaggedError("MembershipNotFound")<{
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
}> {}
