import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { TodoNotFound } from "../domain/todo/todo.errors.js";
import type { TodoId } from "../domain/todo/todo.id.js";
import type { TodoRoot } from "../domain/todo/todo.root.js";

export type CompleteTodoPayload = {
  readonly todoId: TodoId;
  readonly organizationId: OrganizationId;
};

export type CompleteTodoResult = Result<TodoRoot, TodoNotFound | PersistenceUnavailable>;

export class CompleteTodoCommand extends Command<CompleteTodoResult> {
  constructor(public readonly payload: CompleteTodoPayload) {
    super();
  }
}
