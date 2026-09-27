import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { UserNotFound } from "../domain/user/user.errors.js";

export type DeleteUserPayload = { readonly userId: UserId };

export type DeleteUserResult = Result<void, UserNotFound | PersistenceUnavailable>;

export class DeleteUserCommand extends Command<DeleteUserResult> {
  constructor(public readonly payload: DeleteUserPayload) {
    super();
  }
}
