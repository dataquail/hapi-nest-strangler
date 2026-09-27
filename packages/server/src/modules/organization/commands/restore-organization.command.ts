import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type {
  OrganizationNotDeleted,
  OrganizationNotFound,
} from "../domain/organization/organization.errors.js";

export type RestoreOrganizationPayload = { readonly organizationId: OrganizationId };

export type RestoreOrganizationResult = Result<
  void,
  OrganizationNotFound | OrganizationNotDeleted | PersistenceUnavailable
>;

export class RestoreOrganizationCommand extends Command<RestoreOrganizationResult> {
  constructor(public readonly payload: RestoreOrganizationPayload) {
    super();
  }
}
