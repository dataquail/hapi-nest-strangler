import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { LeaveOrganizationCommand } from "@/modules/organization/commands/leave-organization.command.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = OrganizationContract.Group.routes.leave;

@Controller()
@UseGuards(UserAuthGuard)
export class LeaveOrganizationEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async leave(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<void> {
    unwrapOrThrow(
      await this.commandBus.execute(
        new LeaveOrganizationCommand({ userId: caller.userId, organizationId: params.orgId }),
      ),
      {
        MembershipNotFound: () =>
          problem(OrganizationContract.MembershipNotFoundError, {
            message: "You aren't a member of this organization",
          }),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
  }
}
