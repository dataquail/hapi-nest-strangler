import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { TodoNotFound } from "../domain/todo/todo.errors.js";
import type { TodoId } from "../domain/todo/todo.id.js";
import type { TodoRoot } from "../domain/todo/todo.root.js";

export type UpdateTodoPayload = {
  readonly todoId: TodoId;
  readonly organizationId: OrganizationId;
  readonly title: string;
  readonly completed: boolean;
};

export type UpdateTodoResult = Result<TodoRoot, TodoNotFound | PersistenceUnavailable>;

export class UpdateTodoCommand extends Command<UpdateTodoResult> {
  constructor(public readonly payload: UpdateTodoPayload) {
    super();
  }
}
