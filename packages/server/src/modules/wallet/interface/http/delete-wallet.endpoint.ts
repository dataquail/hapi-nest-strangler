import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { InternalWalletContract } from "@org/contracts/api/Contracts";
import type { z } from "zod";

import { DeleteWalletCommand } from "@/modules/wallet/commands/delete-wallet.command.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { InterServiceAuthGuard } from "@/platform/middlewares/inter-service-auth.guard.js";

const route = InternalWalletContract.Group.routes.delete;

// The legacy API's compensation call; absence answers 204 too, so a retry is harmless.
@Controller()
@UseGuards(InterServiceAuthGuard)
export class DeleteWalletEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async delete(
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<void> {
    unwrapOrThrow(
      await this.commandBus.execute(
        new DeleteWalletCommand({ organizationId: params.organizationId }),
      ),
      { PersistenceUnavailable: serviceUnavailable },
    );
  }
}
