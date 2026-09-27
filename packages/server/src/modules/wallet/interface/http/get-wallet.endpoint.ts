import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { InternalWalletContract } from "@org/contracts/api/Contracts";
import type { z } from "zod";

import { FindWalletByOrganizationQuery } from "@/modules/wallet/queries/find-wallet-by-organization.query.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import { InterServiceAuthGuard } from "@/platform/middlewares/inter-service-auth.guard.js";

import { toContract } from "./create-wallet.endpoint.js";

const route = InternalWalletContract.Group.routes.get;

const walletNotFound = (organizationId: OrganizationId) =>
  problem(InternalWalletContract.WalletNotFoundError, {
    message: `No wallet for organization ${organizationId}`,
  });

@Controller()
@UseGuards(InterServiceAuthGuard)
export class GetWalletEndpoint {
  constructor(@Inject(AppQueryBus) private readonly queryBus: AppQueryBus) {}

  @Endpoint(route)
  public async get(
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<InternalWalletContract.Wallet> {
    const view = unwrapOrThrow(
      await this.queryBus.execute(
        new FindWalletByOrganizationQuery({ organizationId: params.organizationId }),
      ),
      { PersistenceUnavailable: serviceUnavailable },
    );
    if (view === null) throw walletNotFound(params.organizationId);
    return toContract(view);
  }
}
