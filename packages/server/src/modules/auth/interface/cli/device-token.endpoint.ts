import { Body, Controller, Inject } from "@nestjs/common";
import { CliAuthContract } from "@org/contracts/api/Contracts";
import type { z } from "zod";

import { EnvVars } from "@/common/env-vars.js";
import { PollDeviceGrantCommand } from "@/modules/auth/commands/poll-device-grant.command.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";

const route = CliAuthContract.DeviceGroup.routes.deviceToken;

// The RFC 8628 shaped outcomes the CLI switches on: keep polling on pending,
// stop on expired or unknown.
@Controller()
export class CliDeviceTokenEndpoint {
  constructor(
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
    @Inject(EnvVars) private readonly env: EnvVars,
  ) {}

  @Endpoint(route)
  public async deviceToken(
    @Body(zodPipe(route.body)) payload: z.infer<typeof route.body>,
  ): Promise<CliAuthContract.DeviceTokenResponse> {
    const { apiToken, token } = unwrapOrThrow(
      await this.commandBus.execute(
        new PollDeviceGrantCommand({
          deviceCode: payload.device_code,
          tokenExpiresInDays: this.env.API_TOKEN_DEFAULT_TTL_DAYS,
        }),
      ),
      {
        DeviceGrantPending: () =>
          problem(CliAuthContract.DeviceAuthorizationPending, { message: "authorization_pending" }),
        DeviceGrantExpired: () =>
          problem(CliAuthContract.DeviceTokenExpired, { message: "expired_token" }),
        DeviceGrantNotFound: () =>
          problem(CliAuthContract.DeviceCodeNotFound, { message: "invalid device code" }),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return {
      access_token: token,
      token_type: "Bearer",
      expires_at: apiToken.expiresAt === null ? null : apiToken.expiresAt.toISOString(),
    };
  }
}
