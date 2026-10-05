import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import { Err, Ok, type Result } from "oxide.ts";

import { TodoAlreadyExists, TodoNotFound } from "@/modules/todos/domain/todo/todo.errors.js";
import type { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import type { TodoRoot } from "@/modules/todos/domain/todo/todo.root.js";
import { TodosRepository } from "@/modules/todos/domain/todo/todos.repository.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as TodoMapper from "./todo.mapper.js";

@Injectable()
export class TodosRepositoryLive extends TodosRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  public insertOne(
    todo: TodoRoot,
  ): Promise<Result<void, TodoAlreadyExists | PersistenceUnavailable>> {
    const row = TodoMapper.toPersistence(todo);
    return translateDatabaseErrors(
      async () => {
        await this.db.exec(sql.unsafe`
          INSERT INTO todos.todos (id, organization_id, title, completed, created_at, updated_at)
          VALUES (${row.id}, ${row.organization_id}, ${row.title}, ${row.completed},
                  ${sql.timestamp(row.created_at)}, ${sql.timestamp(row.updated_at)})
        `);
      },
      (error) =>
        error.type === "unique_violation" ? new TodoAlreadyExists({ todoId: todo.id }) : null,
    );
  }

  public async updateOne(
    todo: TodoRoot,
  ): Promise<Result<void, TodoNotFound | PersistenceUnavailable>> {
    const row = TodoMapper.toPersistence(todo);
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`
        UPDATE todos.todos SET
          title = ${row.title},
          completed = ${row.completed},
          updated_at = ${sql.timestamp(row.updated_at)}
        WHERE id = ${row.id} AND organization_id = ${row.organization_id}
      `),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0 ? Err(new TodoNotFound({ todoId: todo.id })) : Ok(undefined);
  }

  public async deleteOne(
    organizationId: OrganizationId,
    id: TodoId,
  ): Promise<Result<void, TodoNotFound | PersistenceUnavailable>> {
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`
        DELETE FROM todos.todos WHERE id = ${id} AND organization_id = ${organizationId}
      `),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0 ? Err(new TodoNotFound({ todoId: id })) : Ok(undefined);
  }

  public findOne(
    spec: Specification<TodoRoot>,
  ): Promise<Result<TodoRoot | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.TodoRow)`
        SELECT * FROM todos.todos
        WHERE ${criteriaToWhere(spec.criteria, TodoMapper.columns)}
        LIMIT 1
      `);
      return row === null ? null : TodoMapper.toDomain(row);
    });
  }
}
