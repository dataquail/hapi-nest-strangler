import { Controller, Inject, Query, UseGuards } from "@nestjs/common";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { OrganizationCollectionResource } from "@/modules/organization/policies/organization.policies.js";
import {
  FindAllOrganizationsQuery,
  type FindAllOrganizationsResultView,
  type FindAllOrganizationsView,
} from "@/modules/organization/queries/find-all-organizations.query.js";
import { Actions } from "@/platform/auth/actions.js";
import { Authz } from "@/platform/auth/authz.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = OrganizationContract.AdminGroup.routes.findAll;

const toOrganization = (view: FindAllOrganizationsView): OrganizationContract.Organization => ({
  id: view.id,
  name: view.name,
  createdAt: view.createdAt.toISOString(),
  updatedAt: view.updatedAt.toISOString(),
  deletedAt: view.deletedAt === null ? null : view.deletedAt.toISOString(),
});

const toContract = (
  result: FindAllOrganizationsResultView,
): OrganizationContract.PaginatedOrganizations => ({
  organizations: result.organizations.map(toOrganization),
  page: result.page,
  pageSize: result.pageSize,
  total: result.total,
});

@Controller()
@UseGuards(UserAuthGuard)
export class FindAllOrganizationsEndpoint {
  constructor(
    @Inject(AppQueryBus) private readonly queryBus: AppQueryBus,
    @Inject(Authz) private readonly authz: Authz,
  ) {}

  @Endpoint(route)
  public async findAll(
    @Caller() caller: CurrentUser,
    @Query(zodPipe(route.query)) query: z.infer<typeof route.query>,
  ): Promise<OrganizationContract.PaginatedOrganizations> {
    unwrapOrThrow(
      await this.authz.hasPermissions(caller, OrganizationCollectionResource, Actions.Read),
      {
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    const result = unwrapOrThrow(
      await this.queryBus.execute(
        new FindAllOrganizationsQuery({
          page: query.page,
          pageSize: query.pageSize,
          includeDeleted: query.includeDeleted === "true",
        }),
      ),
      { PersistenceUnavailable: serviceUnavailable },
    );
    return toContract(result);
  }
}
