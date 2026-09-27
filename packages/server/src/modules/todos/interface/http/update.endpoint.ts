import { Body, Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { TodosContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { UpdateTodoCommand } from "@/modules/todos/commands/update-todo.command.js";
import type { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { TodoResource } from "@/modules/todos/policies/todos.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import { Authz } from "@/platform/auth/authz.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = TodosContract.Group.routes.update;

const todoNotFound = (todoId: TodoId) =>
  problem(TodosContract.TodoNotFoundError, { message: `Todo with id ${todoId} not found` });

// Only the resolver's generic NotFound becomes the route's own; a denial passes through as 403.
@Controller()
@UseGuards(UserAuthGuard)
export class UpdateTodoEndpoint {
  constructor(
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
    @Inject(Authz) private readonly authz: Authz,
  ) {}

  @Endpoint(route)
  public async update(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
    @Body(zodPipe(route.body)) payload: z.infer<typeof route.body>,
  ): Promise<TodosContract.Todo> {
    unwrapOrThrow(
      await this.authz.hasPermissions(caller, TodoResource, Actions.Update, {
        organizationId: params.orgId,
        todoId: params.id,
      }),
      { PersistenceUnavailable: serviceUnavailable, HttpProblem: () => todoNotFound(params.id) },
    );
    const todo = unwrapOrThrow(
      await this.commandBus.execute(
        new UpdateTodoCommand({
          todoId: params.id,
          organizationId: params.orgId,
          title: payload.title,
          completed: payload.completed,
          userId: caller.userId,
        }),
      ),
      {
        TodoNotFound: (error) => todoNotFound(error.todoId),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return { id: todo.id, title: todo.title, completed: todo.completed };
  }
}
