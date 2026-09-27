import { Inject } from "@nestjs/common";
import { type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { sql } from "@org/database";
import { z } from "zod";

import { Database } from "@/platform/database/database.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import {
  FindTodoOrganizationQuery,
  type FindTodoOrganizationResult,
  type TodoOrganizationView,
} from "./find-todo-organization.query.js";

const OrgIdRow = z.object({ organization_id: z.string() });

@QueryHandler(FindTodoOrganizationQuery)
export class FindTodoOrganizationHandler implements IQueryHandler<FindTodoOrganizationQuery> {
  constructor(@Inject(Database) private readonly db: Database) {}

  public execute({ payload }: FindTodoOrganizationQuery): Promise<FindTodoOrganizationResult> {
    return translateDatabaseErrors(async (): Promise<TodoOrganizationView | null> => {
      const row = await this.db.maybeOne(sql.type(OrgIdRow)`
        SELECT organization_id FROM todos.todos
        WHERE id = ${payload.todoId} AND organization_id = ${payload.organizationId}
      `);
      return row === null ? null : { organizationId: OrganizationId.parse(row.organization_id) };
    });
  }
}
