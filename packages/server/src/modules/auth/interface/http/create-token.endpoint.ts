import { Body, Controller, Inject, UseGuards } from "@nestjs/common";
import { AuthContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { EnvVars } from "@/common/env-vars.js";
import { MintApiTokenCommand } from "@/modules/auth/commands/mint-api-token.command.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = AuthContract.TokensGroup.routes.create;

@Controller()
@UseGuards(UserAuthGuard)
export class CreateTokenEndpoint {
  constructor(
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
    @Inject(EnvVars) private readonly env: EnvVars,
  ) {}

  @Endpoint(route)
  public async create(
    @Caller() caller: CurrentUser,
    @Body(zodPipe(route.body)) payload: z.infer<typeof route.body>,
  ): Promise<AuthContract.CreateApiTokenResponse> {
    const { apiToken, token } = unwrapOrThrow(
      await this.commandBus.execute(
        new MintApiTokenCommand({
          userId: caller.userId,
          label: payload.label,
          expiresInDays: payload.expiresInDays ?? this.env.API_TOKEN_DEFAULT_TTL_DAYS,
        }),
      ),
      { PersistenceUnavailable: serviceUnavailable },
    );
    return {
      id: apiToken.id,
      token,
      prefix: apiToken.prefix,
      expiresAt: apiToken.expiresAt === null ? null : apiToken.expiresAt.toISOString(),
    };
  }
}
