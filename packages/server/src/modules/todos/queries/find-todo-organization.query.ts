import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { TodoId } from "../domain/todo/todo.id.js";

export type TodoOrganizationView = { readonly organizationId: OrganizationId };

export type FindTodoOrganizationPayload = {
  readonly organizationId: OrganizationId;
  readonly todoId: TodoId;
};

export type FindTodoOrganizationResult = Result<
  TodoOrganizationView | null,
  PersistenceUnavailable
>;

// Existence projection backing the per-item `todo` authz resource. Scoped to
// BOTH ids, so a todo living in another organization reads as absent — tenant
// isolation folded into the resolve step. Absence is null; the resolver turns
// it into NotFound.
export class FindTodoOrganizationQuery extends Query<FindTodoOrganizationResult> {
  constructor(public readonly payload: FindTodoOrganizationPayload) {
    super();
  }
}
