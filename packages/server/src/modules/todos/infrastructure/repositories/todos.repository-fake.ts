import { Err, Ok, type Result } from "oxide.ts";

import { TodoAlreadyExists, TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.js";
import type { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import type { TodoRoot } from "@/modules/todos/domain/todo/todo.root.js";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

export class TodosRepositoryFake extends TodosRepository {
  private readonly store = new Map<TodoId, TodoRoot>();

  public insertOne(
    todo: TodoRoot,
  ): Promise<Result<void, TodoAlreadyExists | PersistenceUnavailable>> {
    if (this.store.has(todo.id)) {
      return Promise.resolve(Err(new TodoAlreadyExists({ todoId: todo.id })));
    }
    this.store.set(todo.id, todo);
    return Promise.resolve(Ok(undefined));
  }

  public updateOne(todo: TodoRoot): Promise<Result<void, TodoNotFound | PersistenceUnavailable>> {
    const found = this.store.get(todo.id);
    if (found === undefined || found.organizationId !== todo.organizationId) {
      return Promise.resolve(Err(new TodoNotFound({ todoId: todo.id })));
    }
    this.store.set(todo.id, todo);
    return Promise.resolve(Ok(undefined));
  }

  public deleteOne(
    organizationId: OrganizationId,
    id: TodoId,
  ): Promise<Result<void, TodoNotFound | PersistenceUnavailable>> {
    const found = this.store.get(id);
    if (found === undefined || found.organizationId !== organizationId) {
      return Promise.resolve(Err(new TodoNotFound({ todoId: id })));
    }
    this.store.delete(id);
    return Promise.resolve(Ok(undefined));
  }

  public findOne(
    spec: Specification<TodoRoot>,
  ): Promise<Result<TodoRoot | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].find(spec) ?? null));
  }
}
