import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

export type UserOrganizationRolesView = {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly roles: ReadonlyArray<string>;
};

export type FindUserOrganizationRolesPayload = {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
};

export type FindUserOrganizationRolesResult = Result<
  UserOrganizationRolesView,
  PersistenceUnavailable
>;

// Published for other modules' authorization checks (ADR-0022).
export class FindUserOrganizationRolesQuery extends Query<FindUserOrganizationRolesResult> {
  constructor(public readonly payload: FindUserOrganizationRolesPayload) {
    super();
  }
}
