import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type {
  OrganizationAlreadyDeleted,
  OrganizationNotFound,
} from "../domain/organization/organization.errors.js";

export type SoftDeleteOrganizationPayload = { readonly organizationId: OrganizationId };

export type SoftDeleteOrganizationResult = Result<
  void,
  OrganizationNotFound | OrganizationAlreadyDeleted | PersistenceUnavailable
>;

export class SoftDeleteOrganizationCommand extends Command<SoftDeleteOrganizationResult> {
  constructor(public readonly payload: SoftDeleteOrganizationPayload) {
    super();
  }
}
