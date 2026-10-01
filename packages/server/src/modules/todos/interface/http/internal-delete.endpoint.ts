import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { InternalTodosContract } from "@org/contracts/api/Contracts";
import type { z } from "zod";

import { DeleteTodoCommand } from "@/modules/todos/commands/delete-todo.command.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { InterServiceAuthGuard } from "@/platform/middlewares/inter-service-auth.guard.js";

import { todoNotFound } from "./internal-create.endpoint.js";

const route = InternalTodosContract.Group.routes.delete;

@Controller()
@UseGuards(InterServiceAuthGuard)
export class InternalDeleteTodoEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async delete(
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<void> {
    unwrapOrThrow(
      await this.commandBus.execute(
        new DeleteTodoCommand({ todoId: params.id, organizationId: params.organizationId }),
      ),
      {
        TodoNotFound: (error) => todoNotFound(error.todoId),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
  }
}
