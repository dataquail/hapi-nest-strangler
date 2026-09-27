import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { AuthContract } from "@org/contracts/api/Contracts";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { RevokeApiTokenCommand } from "@/modules/auth/commands/revoke-api-token.command.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = AuthContract.TokensGroup.routes.revoke;

@Controller()
@UseGuards(UserAuthGuard)
export class RevokeTokenEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async revoke(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<void> {
    unwrapOrThrow(
      await this.commandBus.execute(
        new RevokeApiTokenCommand({ apiTokenId: params.id, userId: caller.userId }),
      ),
      {
        ApiTokenNotFound: () => problem(HttpErrors.NotFound, { message: "API token not found" }),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
  }
}
