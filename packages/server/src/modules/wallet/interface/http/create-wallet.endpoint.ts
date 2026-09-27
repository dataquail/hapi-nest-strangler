import { Body, Controller, Inject, UseGuards } from "@nestjs/common";
import { InternalWalletContract } from "@org/contracts/api/Contracts";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { z } from "zod";

import { CreateWalletCommand } from "@/modules/wallet/commands/create-wallet.command.js";
import {
  FindWalletByOrganizationQuery,
  type WalletView,
} from "@/modules/wallet/queries/find-wallet-by-organization.query.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { InterServiceAuthGuard } from "@/platform/middlewares/inter-service-auth.guard.js";

const route = InternalWalletContract.Group.routes.create;

export const toContract = (view: WalletView): InternalWalletContract.Wallet => ({
  id: view.id,
  organizationId: view.organizationId,
  balance: view.balance,
});

// Idempotent: the legacy API may retry a create it is not sure landed, and
// gets the same wallet back either way.
@Controller()
@UseGuards(InterServiceAuthGuard)
export class CreateWalletEndpoint {
  constructor(
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
    @Inject(AppQueryBus) private readonly queryBus: AppQueryBus,
  ) {}

  @Endpoint(route)
  public async create(
    @Body(zodPipe(route.body)) body: z.infer<typeof route.body>,
  ): Promise<InternalWalletContract.Wallet> {
    unwrapOrThrow(
      await this.commandBus.execute(
        new CreateWalletCommand({ organizationId: body.organizationId }),
      ),
      { PersistenceUnavailable: serviceUnavailable },
    );
    const view = unwrapOrThrow(
      await this.queryBus.execute(
        new FindWalletByOrganizationQuery({ organizationId: body.organizationId }),
      ),
      { PersistenceUnavailable: serviceUnavailable },
    );
    if (view === null) {
      throw problem(HttpErrors.ServiceUnavailable, {
        message: "Wallet disappeared between creation and read-back",
      });
    }
    return toContract(view);
  }
}
