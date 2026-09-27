import { Body, Controller, Inject, UseGuards } from "@nestjs/common";
import { UserContract } from "@org/contracts/api/Contracts";

import { CreateUserCommand } from "@/modules/user/commands/create-user.command.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

@Controller()
@UseGuards(UserAuthGuard)
export class CreateUserEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(UserContract.Group.routes.create)
  public async create(
    @Body(zodPipe(UserContract.CreateUserPayload)) payload: UserContract.CreateUserPayload,
  ): Promise<UserContract.CreateUserResponse> {
    const result = await this.commandBus.execute(
      new CreateUserCommand({
        email: payload.email,
        country: payload.country,
        street: payload.street,
        postalCode: payload.postalCode,
      }),
    );
    const id = unwrapOrThrow(result, {
      UserAlreadyExists: (error) =>
        problem(UserContract.UserAlreadyExistsError, {
          email: error.email,
          message: `A user with email ${error.email} already exists`,
        }),
      PersistenceUnavailable: serviceUnavailable,
    });
    return { id };
  }
}
