import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

export type MembershipView = { readonly isMember: boolean };

export type FindMembershipPayload = {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
};

export type FindMembershipResult = Result<MembershipView, PersistenceUnavailable>;

// Published for other modules' authorization checks (ADR-0022).
export class FindMembershipQuery extends Query<FindMembershipResult> {
  constructor(public readonly payload: FindMembershipPayload) {
    super();
  }
}
