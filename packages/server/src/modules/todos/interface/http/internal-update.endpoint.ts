import { Body, Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { InternalTodosContract } from "@org/contracts/api/Contracts";
import type { z } from "zod";

import { UpdateTodoCommand } from "@/modules/todos/commands/update-todo.command.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { InterServiceAuthGuard } from "@/platform/middlewares/inter-service-auth.guard.js";

import { toContract, todoNotFound } from "./internal-create.endpoint.js";

const route = InternalTodosContract.Group.routes.update;

@Controller()
@UseGuards(InterServiceAuthGuard)
export class InternalUpdateTodoEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async update(
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
    @Body(zodPipe(route.body)) body: z.infer<typeof route.body>,
  ): Promise<InternalTodosContract.InternalTodo> {
    const todo = unwrapOrThrow(
      await this.commandBus.execute(
        new UpdateTodoCommand({
          todoId: params.id,
          organizationId: params.organizationId,
          title: body.title,
          completed: body.completed,
        }),
      ),
      {
        TodoNotFound: (error) => todoNotFound(error.todoId),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return toContract(todo);
  }
}
