import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { TodoNotFound } from "../domain/todo/todo.errors.js";
import type { TodoId } from "../domain/todo/todo.id.js";

export type DeleteTodoPayload = {
  readonly todoId: TodoId;
  readonly organizationId: OrganizationId;
};

export type DeleteTodoResult = Result<void, TodoNotFound | PersistenceUnavailable>;

export class DeleteTodoCommand extends Command<DeleteTodoResult> {
  constructor(public readonly payload: DeleteTodoPayload) {
    super();
  }
}
