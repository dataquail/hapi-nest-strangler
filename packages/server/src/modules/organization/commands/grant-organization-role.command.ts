import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type {
  AlreadyHasOrganizationRole,
  CannotPromoteSelfInOrganization,
} from "../domain/organization-roles/organization-role.errors.js";
import type { OrganizationRoleValueObject } from "../domain/organization-roles/organization-role.value-object.js";

export type GrantOrganizationRolePayload = {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly role: OrganizationRoleValueObject;
  readonly actorUserId: UserId;
};

export type GrantOrganizationRoleResult = Result<
  void,
  AlreadyHasOrganizationRole | CannotPromoteSelfInOrganization | PersistenceUnavailable
>;

export class GrantOrganizationRoleCommand extends Command<GrantOrganizationRoleResult> {
  constructor(public readonly payload: GrantOrganizationRolePayload) {
    super();
  }
}
