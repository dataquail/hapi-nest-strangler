import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { SuperAdminCannotOwnOrganization } from "../domain/organization/organization.errors.js";

export type CreateOrganizationPayload = { readonly name: string; readonly actorUserId: UserId };

export type CreateOrganizationResult = Result<
  OrganizationId,
  SuperAdminCannotOwnOrganization | PersistenceUnavailable
>;

export class CreateOrganizationCommand extends Command<CreateOrganizationResult> {
  constructor(public readonly payload: CreateOrganizationPayload) {
    super();
  }
}
