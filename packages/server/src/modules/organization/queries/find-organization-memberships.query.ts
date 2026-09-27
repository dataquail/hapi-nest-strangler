import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

export type OrganizationMemberView = {
  readonly userId: UserId;
  readonly email: string;
  readonly joinedAt: Date;
  readonly isAdmin: boolean;
};

export type FindOrganizationMembershipsPayload = { readonly organizationId: OrganizationId };

export type FindOrganizationMembershipsResult = Result<
  ReadonlyArray<OrganizationMemberView>,
  PersistenceUnavailable
>;

export class FindOrganizationMembershipsQuery extends Query<FindOrganizationMembershipsResult> {
  constructor(public readonly payload: FindOrganizationMembershipsPayload) {
    super();
  }
}
