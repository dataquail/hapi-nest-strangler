import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { UserContract } from "@org/contracts/api/Contracts";
import type { z } from "zod";

import { DeleteUserCommand } from "@/modules/user/commands/delete-user.command.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const Params = UserContract.Group.routes.delete.params;

@Controller()
@UseGuards(UserAuthGuard)
export class DeleteUserEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(UserContract.Group.routes.delete)
  public async delete(@Param(zodPipe(Params)) params: z.infer<typeof Params>): Promise<void> {
    const result = await this.commandBus.execute(new DeleteUserCommand({ userId: params.id }));
    unwrapOrThrow(result, {
      UserNotFound: (error) =>
        problem(UserContract.UserNotFoundError, {
          userId: error.userId,
          message: `User ${error.userId} not found`,
        }),
      PersistenceUnavailable: serviceUnavailable,
    });
  }
}
