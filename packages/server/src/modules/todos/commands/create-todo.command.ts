import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { TodoRoot } from "../domain/todo/todo.root.js";

export type CreateTodoPayload = {
  readonly title: string;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
};

export type CreateTodoResult = Result<TodoRoot, PersistenceUnavailable>;

export class CreateTodoCommand extends Command<CreateTodoResult> {
  constructor(public readonly payload: CreateTodoPayload) {
    super();
  }
}
