import { Body, Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { InternalTodosContract } from "@org/contracts/api/Contracts";
import type { z } from "zod";

import { CreateTodoCommand } from "@/modules/todos/commands/create-todo.command.js";
import type { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import type { TodoRoot } from "@/modules/todos/domain/todo/todo.root.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { InterServiceAuthGuard } from "@/platform/middlewares/inter-service-auth.guard.js";

const route = InternalTodosContract.Group.routes.create;

export const toContract = (todo: TodoRoot): InternalTodosContract.InternalTodo => ({
  id: todo.id,
  organizationId: todo.organizationId,
  title: todo.title,
  completed: todo.completed,
});

export const todoNotFound = (todoId: TodoId) =>
  problem(InternalTodosContract.InternalTodoNotFoundError, {
    message: `Todo ${todoId} has not been mirrored here`,
  });

const todoAlreadyExists = (todoId: TodoId) =>
  problem(InternalTodosContract.InternalTodoAlreadyExistsError, {
    message: `Todo ${todoId} is already mirrored here`,
  });

@Controller()
@UseGuards(InterServiceAuthGuard)
export class InternalCreateTodoEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async create(
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
    @Body(zodPipe(route.body)) body: z.infer<typeof route.body>,
  ): Promise<InternalTodosContract.InternalTodo> {
    const todo = unwrapOrThrow(
      await this.commandBus.execute(
        new CreateTodoCommand({
          id: body.id,
          organizationId: params.organizationId,
          title: body.title,
        }),
      ),
      {
        TodoAlreadyExists: (error) => todoAlreadyExists(error.todoId),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return toContract(todo);
  }
}
