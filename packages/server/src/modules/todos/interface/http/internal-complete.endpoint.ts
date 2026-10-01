import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { InternalTodosContract } from "@org/contracts/api/Contracts";
import type { z } from "zod";

import { CompleteTodoCommand } from "@/modules/todos/commands/complete-todo.command.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { InterServiceAuthGuard } from "@/platform/middlewares/inter-service-auth.guard.js";

import { toContract, todoNotFound } from "./internal-create.endpoint.js";

const route = InternalTodosContract.Group.routes.complete;

@Controller()
@UseGuards(InterServiceAuthGuard)
export class InternalCompleteTodoEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async complete(
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<InternalTodosContract.InternalTodo> {
    const todo = unwrapOrThrow(
      await this.commandBus.execute(
        new CompleteTodoCommand({ todoId: params.id, organizationId: params.organizationId }),
      ),
      {
        TodoNotFound: (error) => todoNotFound(error.todoId),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return toContract(todo);
  }
}
