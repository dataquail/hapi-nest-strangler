import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { DoesNotHaveRole } from "../domain/roles/role.errors.js";
import type { RoleValueObject } from "../domain/roles/role.value-object.js";

export type RevokeRolePayload = {
  readonly userId: UserId;
  readonly role: RoleValueObject;
};

export type RevokeRoleResult = Result<void, DoesNotHaveRole | PersistenceUnavailable>;

export class RevokeRoleCommand extends Command<RevokeRoleResult> {
  constructor(public readonly payload: RevokeRolePayload) {
    super();
  }
}
