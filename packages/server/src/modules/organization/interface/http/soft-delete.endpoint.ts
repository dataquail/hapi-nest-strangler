import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { SoftDeleteOrganizationCommand } from "@/modules/organization/commands/soft-delete-organization.command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import { Authz } from "@/platform/auth/authz.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = OrganizationContract.Group.routes.softDelete;

const organizationNotFound = (organizationId: OrganizationId) =>
  problem(OrganizationContract.OrganizationNotFoundError, {
    organizationId,
    message: `Organization ${organizationId} not found`,
  });

@Controller()
@UseGuards(UserAuthGuard)
export class SoftDeleteOrganizationEndpoint {
  constructor(
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
    @Inject(Authz) private readonly authz: Authz,
  ) {}

  @Endpoint(route)
  public async softDelete(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<void> {
    unwrapOrThrow(
      await this.authz.hasPermissions(caller, OrganizationResource, Actions.Delete, params.id),
      {
        PersistenceUnavailable: serviceUnavailable,
        HttpProblem: () => organizationNotFound(params.id),
      },
    );
    unwrapOrThrow(
      await this.commandBus.execute(
        new SoftDeleteOrganizationCommand({ organizationId: params.id }),
      ),
      {
        OrganizationNotFound: (error) => organizationNotFound(error.organizationId),
        OrganizationAlreadyDeleted: (error) => organizationNotFound(error.organizationId),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
  }
}
