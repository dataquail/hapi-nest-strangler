import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { CliTodosContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { DeleteTodoCommand } from "@/modules/todos/commands/delete-todo.command.js";
import type { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { TodoResource } from "@/modules/todos/policies/todos.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import { Authz } from "@/platform/auth/authz.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = CliTodosContract.Group.routes.remove;

const todoNotFound = (todoId: TodoId) =>
  problem(CliTodosContract.CliTodoNotFoundError, { message: `Todo with id ${todoId} not found` });

// Only the resolver's generic NotFound becomes the route's own; a denial passes through as 403.
@Controller()
@UseGuards(UserAuthGuard)
export class CliRemoveTodoEndpoint {
  constructor(
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
    @Inject(Authz) private readonly authz: Authz,
  ) {}

  @Endpoint(route)
  public async remove(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<void> {
    unwrapOrThrow(
      await this.authz.hasPermissions(caller, TodoResource, Actions.Delete, {
        organizationId: params.orgId,
        todoId: params.id,
      }),
      { PersistenceUnavailable: serviceUnavailable, HttpProblem: () => todoNotFound(params.id) },
    );
    unwrapOrThrow(
      await this.commandBus.execute(
        new DeleteTodoCommand({
          todoId: params.id,
          organizationId: params.orgId,
          userId: caller.userId,
        }),
      ),
      {
        TodoNotFound: (error) => todoNotFound(error.todoId),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
  }
}
