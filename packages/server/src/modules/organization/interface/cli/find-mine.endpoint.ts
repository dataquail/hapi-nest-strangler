import { Controller, Inject, UseGuards } from "@nestjs/common";
import { CliOrganizationContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";

import {
  FindMyOrganizationsQuery,
  type FindMyOrganizationsView,
} from "@/modules/organization/queries/find-my-organizations.query.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow } from "@/platform/http/endpoint.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = CliOrganizationContract.Group.routes.listMine;

const toCli = (view: FindMyOrganizationsView): CliOrganizationContract.CliOrganization => ({
  id: view.id,
  name: view.name,
  isAdmin: view.isAdmin,
});

@Controller()
@UseGuards(UserAuthGuard)
export class CliFindMyOrganizationsEndpoint {
  constructor(@Inject(AppQueryBus) private readonly queryBus: AppQueryBus) {}

  @Endpoint(route)
  public async listMine(
    @Caller() caller: CurrentUser,
  ): Promise<ReadonlyArray<CliOrganizationContract.CliOrganization>> {
    const result = unwrapOrThrow(
      await this.queryBus.execute(new FindMyOrganizationsQuery({ userId: caller.userId })),
      {
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return result.organizations.map(toCli);
  }
}
