import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { TodoId } from "../domain/todo/todo.id.js";

export type ListTodosTodoView = {
  readonly id: TodoId;
  readonly title: string;
  readonly completed: boolean;
};

export type ListTodosResultView = { readonly todos: ReadonlyArray<ListTodosTodoView> };

export type ListTodosPayload = { readonly organizationId: OrganizationId };

export type ListTodosResult = Result<ListTodosResultView, PersistenceUnavailable>;

export class ListTodosQuery extends Query<ListTodosResult> {
  constructor(public readonly payload: ListTodosPayload) {
    super();
  }
}
