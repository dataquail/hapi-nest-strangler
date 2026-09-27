import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

export type FindAllOrganizationsView = {
  readonly id: OrganizationId;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
};

export type FindAllOrganizationsResultView = {
  readonly organizations: ReadonlyArray<FindAllOrganizationsView>;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
};

export type FindAllOrganizationsPayload = {
  readonly page: number;
  readonly pageSize: number;
  readonly includeDeleted: boolean;
};

export type FindAllOrganizationsResult = Result<
  FindAllOrganizationsResultView,
  PersistenceUnavailable
>;

export class FindAllOrganizationsQuery extends Query<FindAllOrganizationsResult> {
  constructor(public readonly payload: FindAllOrganizationsPayload) {
    super();
  }
}
