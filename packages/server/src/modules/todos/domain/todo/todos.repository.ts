import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { TodoNotFound } from "./todo.errors.js";
import type { TodoId } from "./todo.id.js";
import type { TodoRoot } from "./todo.root.js";

// Dumb persistence (ADR-0005): absence is a plain null; a row in another org
// reads as absent, never as a leak.
export abstract class TodosRepository {
  public abstract insertOne(todo: TodoRoot): Promise<Result<void, PersistenceUnavailable>>;
  public abstract updateOne(
    todo: TodoRoot,
  ): Promise<Result<void, TodoNotFound | PersistenceUnavailable>>;
  public abstract deleteOne(
    organizationId: OrganizationId,
    id: TodoId,
  ): Promise<Result<void, TodoNotFound | PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<TodoRoot>,
  ): Promise<Result<TodoRoot | null, PersistenceUnavailable>>;
}
