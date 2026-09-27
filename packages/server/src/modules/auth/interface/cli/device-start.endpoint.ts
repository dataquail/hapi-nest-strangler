import { Controller, Inject } from "@nestjs/common";
import { CliAuthContract } from "@org/contracts/api/Contracts";

import { EnvVars } from "@/common/env-vars.js";
import { StartDeviceGrantCommand } from "@/modules/auth/commands/start-device-grant.command.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow } from "@/platform/http/endpoint.js";

const route = CliAuthContract.DeviceGroup.routes.deviceStart;

@Controller()
export class CliDeviceStartEndpoint {
  constructor(
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
    @Inject(EnvVars) private readonly env: EnvVars,
  ) {}

  @Endpoint(route)
  public async deviceStart(): Promise<CliAuthContract.DeviceStartResponse> {
    const { deviceCode, userCode } = unwrapOrThrow(
      await this.commandBus.execute(
        new StartDeviceGrantCommand({ ttlSeconds: this.env.DEVICE_CODE_TTL_SECONDS }),
      ),
      { PersistenceUnavailable: serviceUnavailable },
    );
    const verificationUri = `${this.env.APP_URL}/device`;
    return {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: verificationUri,
      verification_uri_complete: `${verificationUri}?code=${encodeURIComponent(userCode)}`,
      interval: this.env.DEVICE_POLL_INTERVAL_SECONDS,
      expires_in: this.env.DEVICE_CODE_TTL_SECONDS,
    };
  }
}
