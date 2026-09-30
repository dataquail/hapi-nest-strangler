import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { RowSchemas, sql } from "@org/database";

import { Database } from "@/platform/database/database.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import { TodoId } from "../domain/todo/todo.id.js";
import {
  ListTodosQuery,
  type ListTodosResult,
  type ListTodosTodoView,
} from "./list-todos.query.js";

const toView = (row: RowSchemas.TodoRow): ListTodosTodoView => ({
  id: TodoId.parse(row.id),
  title: row.title,
  completed: row.completed,
});

@QueryHandler(ListTodosQuery)
export class ListTodosHandler implements IQueryHandler<ListTodosQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({ payload }: ListTodosQuery): Promise<ListTodosResult> {
    return translateDatabaseErrors(async () => {
      const rows = await this.db.any(sql.type(RowSchemas.TodoRow)`
        SELECT * FROM todos.todos
        WHERE organization_id = ${payload.organizationId}
        ORDER BY created_at DESC
      `);
      return { todos: rows.map(toView) };
    });
  }
}
