import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { DoesNotHaveOrganizationRole } from "../domain/organization-roles/organization-role.errors.js";
import type { OrganizationRoleValueObject } from "../domain/organization-roles/organization-role.value-object.js";

export type RevokeOrganizationRolePayload = {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly role: OrganizationRoleValueObject;
};

export type RevokeOrganizationRoleResult = Result<
  void,
  DoesNotHaveOrganizationRole | PersistenceUnavailable
>;

export class RevokeOrganizationRoleCommand extends Command<RevokeOrganizationRoleResult> {
  constructor(public readonly payload: RevokeOrganizationRolePayload) {
    super();
  }
}
