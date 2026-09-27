import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { UserAlreadyExists } from "../domain/user/user.errors.js";

export type CreateUserPayload = {
  readonly email: string;
  readonly country?: string;
  readonly street?: string;
  readonly postalCode?: string;
};

export type CreateUserResult = Result<UserId, UserAlreadyExists | PersistenceUnavailable>;

export class CreateUserCommand extends Command<CreateUserResult> {
  constructor(public readonly payload: CreateUserPayload) {
    super();
  }
}
