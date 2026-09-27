import { Controller, Inject, UseGuards } from "@nestjs/common";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";

import {
  FindMyOrganizationsQuery,
  type FindMyOrganizationsView,
} from "@/modules/organization/queries/find-my-organizations.query.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow } from "@/platform/http/endpoint.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = OrganizationContract.Group.routes.findMine;

const toContract = (view: FindMyOrganizationsView): OrganizationContract.MyOrganization => ({
  id: view.id,
  name: view.name,
  createdAt: view.createdAt.toISOString(),
  updatedAt: view.updatedAt.toISOString(),
  deletedAt: null,
  isAdmin: view.isAdmin,
});

@Controller()
@UseGuards(UserAuthGuard)
export class FindMyOrganizationsEndpoint {
  constructor(@Inject(AppQueryBus) private readonly queryBus: AppQueryBus) {}

  @Endpoint(route)
  public async findMine(
    @Caller() caller: CurrentUser,
  ): Promise<ReadonlyArray<OrganizationContract.MyOrganization>> {
    const result = unwrapOrThrow(
      await this.queryBus.execute(new FindMyOrganizationsQuery({ userId: caller.userId })),
      {
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return result.organizations.map(toContract);
  }
}
