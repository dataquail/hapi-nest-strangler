import { Body, Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { TodosContract } from "@org/contracts/api/Contracts";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { CreateTodoCommand } from "@/modules/todos/commands/create-todo.command.js";
import { TodoCollectionResource } from "@/modules/todos/policies/todos.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import { Authz } from "@/platform/auth/authz.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = TodosContract.Group.routes.create;

@Controller()
@UseGuards(UserAuthGuard)
export class CreateTodoEndpoint {
  constructor(
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
    @Inject(Authz) private readonly authz: Authz,
  ) {}

  @Endpoint(route)
  public async create(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
    @Body(zodPipe(route.body)) payload: z.infer<typeof route.body>,
  ): Promise<TodosContract.Todo> {
    unwrapOrThrow(
      await this.authz.hasPermissions(caller, TodoCollectionResource, Actions.Create, params.orgId),
      { PersistenceUnavailable: serviceUnavailable },
    );
    const todo = unwrapOrThrow(
      await this.commandBus.execute(
        new CreateTodoCommand({
          title: payload.title,
          organizationId: params.orgId,
        }),
      ),
      {
        TodoAlreadyExists: (error) =>
          problem(HttpErrors.Conflict, { message: `Todo ${error.todoId} already exists` }),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return { id: todo.id, title: todo.title, completed: todo.completed };
  }
}
