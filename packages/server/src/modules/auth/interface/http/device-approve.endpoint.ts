import { Body, Controller, Inject, UseGuards } from "@nestjs/common";
import { AuthContract } from "@org/contracts/api/Contracts";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { ApproveDeviceGrantCommand } from "@/modules/auth/commands/approve-device-grant.command.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = AuthContract.DeviceApprovalGroup.routes.approve;

@Controller()
@UseGuards(UserAuthGuard)
export class DeviceApproveEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async approve(
    @Caller() caller: CurrentUser,
    @Body(zodPipe(route.body)) payload: z.infer<typeof route.body>,
  ): Promise<void> {
    unwrapOrThrow(
      await this.commandBus.execute(
        new ApproveDeviceGrantCommand({ userCode: payload.userCode, userId: caller.userId }),
      ),
      {
        DeviceGrantNotFound: () =>
          problem(HttpErrors.NotFound, { message: "No pending device request for that code" }),
        DeviceGrantExpired: () =>
          problem(HttpErrors.Gone, { message: "That device code has expired" }),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
  }
}
