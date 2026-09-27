import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

export type FindMyOrganizationsView = {
  readonly id: OrganizationId;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly isAdmin: boolean;
};

export type FindMyOrganizationsResultView = {
  readonly organizations: ReadonlyArray<FindMyOrganizationsView>;
};

export type FindMyOrganizationsPayload = { readonly userId: UserId };

export type FindMyOrganizationsResult = Result<
  FindMyOrganizationsResultView,
  PersistenceUnavailable
>;

export class FindMyOrganizationsQuery extends Query<FindMyOrganizationsResult> {
  constructor(public readonly payload: FindMyOrganizationsPayload) {
    super();
  }
}
