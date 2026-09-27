import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { AlreadyHasRole, CannotPromoteSelf } from "../domain/roles/role.errors.js";
import type { RoleValueObject } from "../domain/roles/role.value-object.js";

export type GrantRolePayload = {
  readonly userId: UserId;
  readonly role: RoleValueObject;
  readonly actorUserId: UserId;
};

export type GrantRoleResult = Result<
  void,
  AlreadyHasRole | CannotPromoteSelf | PersistenceUnavailable
>;

export class GrantRoleCommand extends Command<GrantRoleResult> {
  constructor(public readonly payload: GrantRolePayload) {
    super();
  }
}
