import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

export type OrganizationAuthzView = { readonly organizationId: OrganizationId };

export type FindOrganizationByIdPayload = { readonly organizationId: OrganizationId };

export type FindOrganizationByIdResult = Result<
  OrganizationAuthzView | null,
  PersistenceUnavailable
>;

// Existence projection backing the `organization` authz resource: as small as the id itself.
export class FindOrganizationByIdQuery extends Query<FindOrganizationByIdResult> {
  constructor(public readonly payload: FindOrganizationByIdPayload) {
    super();
  }
}
