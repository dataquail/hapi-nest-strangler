import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { RevokeOrganizationRoleCommand } from "@/modules/organization/commands/revoke-organization-role.command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import { Authz } from "@/platform/auth/authz.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = OrganizationContract.Group.routes.demoteMember;

@Controller()
@UseGuards(UserAuthGuard)
export class DemoteMemberEndpoint {
  constructor(
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
    @Inject(Authz) private readonly authz: Authz,
  ) {}

  @Endpoint(route)
  public async demote(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<void> {
    unwrapOrThrow(
      await this.authz.hasPermissions(caller, OrganizationResource, Actions.Update, params.orgId),
      {
        PersistenceUnavailable: serviceUnavailable,
        HttpProblem: () =>
          problem(OrganizationContract.OrganizationNotFoundError, {
            organizationId: params.orgId,
            message: `Organization ${params.orgId} not found`,
          }),
      },
    );
    unwrapOrThrow(
      await this.commandBus.execute(
        new RevokeOrganizationRoleCommand({
          userId: params.userId,
          organizationId: params.orgId,
          role: "admin",
        }),
      ),
      {
        DoesNotHaveOrganizationRole: () =>
          problem(OrganizationContract.OrganizationRoleConflictError, {
            reason: "not_admin",
            message: "Member is not an admin of this organization",
          }),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
  }
}
