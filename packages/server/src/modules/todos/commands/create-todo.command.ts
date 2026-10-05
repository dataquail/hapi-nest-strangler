import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { TodoAlreadyExists } from "../domain/todo/todo.errors.js";
import type { TodoId } from "../domain/todo/todo.id.js";
import type { TodoRoot } from "../domain/todo/todo.root.js";

// `id` is given while the legacy API mirrors its own todos here, so the
// replica keeps the identities clients already hold; a user-facing create
// leaves it out and the handler mints one.
export type CreateTodoPayload = {
  readonly id?: TodoId;
  readonly title: string;
  readonly organizationId: OrganizationId;
};

export type CreateTodoResult = Result<TodoRoot, TodoAlreadyExists | PersistenceUnavailable>;

export class CreateTodoCommand extends Command<CreateTodoResult> {
  constructor(public readonly payload: CreateTodoPayload) {
    super();
  }
}
