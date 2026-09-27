import type Bookshelf from "bookshelf";
import { randomUUID } from "crypto";
import type { Knex } from "knex";

type TodoRow = {
  id: string;
  organization_id: string;
  title: string;
  completed: boolean;
  created_at: Date;
  updated_at: Date;
};

const toJson = (row: TodoRow) => ({ id: row.id, title: row.title, completed: row.completed });

class TodoService {
  public bookshelf: Bookshelf;

  constructor(bookshelf: Bookshelf) {
    this.bookshelf = bookshelf;
  }

  // @types/bookshelf is typed against knex 0.21; the instance is knex 2.
  get knex(): Knex {
    return this.bookshelf.knex as unknown as Knex;
  }

  async listTodos(organization: any) {
    const rows: TodoRow[] = await this.knex("todos")
      .where({ organization_id: organization.get("id") })
      .orderBy("created_at", "desc");
    return rows.map(toJson);
  }

  async createTodo(organization: any, title: string) {
    const now = new Date();
    const row: TodoRow = {
      id: randomUUID(),
      organization_id: organization.get("id"),
      title,
      completed: false,
      created_at: now,
      updated_at: now,
    };
    await this.knex("todos").insert(row);
    return toJson(row);
  }

  async updateTodo(todo: any, input: { title: string; completed: boolean }) {
    const now = new Date();
    await this.knex("todos")
      .where({ id: todo.get("id") })
      .update({ title: input.title, completed: input.completed, updated_at: now });
    return { id: todo.get("id"), title: input.title, completed: input.completed };
  }

  // Idempotent: completing a done todo re-stamps updated_at.
  async completeTodo(todo: any) {
    await this.knex("todos")
      .where({ id: todo.get("id") })
      .update({ completed: true, updated_at: new Date() });
    return { id: todo.get("id"), title: todo.get("title"), completed: true };
  }

  async deleteTodo(todo: any) {
    await this.knex("todos")
      .where({ id: todo.get("id") })
      .del();
  }
}

TodoService["@singleton"] = true;
TodoService["@require"] = ["bookshelf"];

export = TodoService;
