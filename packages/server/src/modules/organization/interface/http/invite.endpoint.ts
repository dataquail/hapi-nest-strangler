import { Body, Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { InviteUserCommand } from "@/modules/organization/commands/invite-user.command.js";
import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import { Authz } from "@/platform/auth/authz.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = OrganizationContract.Group.routes.inviteUser;

const DEFAULT_INVITATION_TTL_SECONDS = 60 * 60 * 24 * 7;

@Controller()
@UseGuards(UserAuthGuard)
export class InviteUserEndpoint {
  constructor(
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
    @Inject(Authz) private readonly authz: Authz,
  ) {}

  @Endpoint(route)
  public async invite(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
    @Body(zodPipe(route.body)) payload: z.infer<typeof route.body>,
  ): Promise<OrganizationContract.InviteUserResponse> {
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
    const invitationId = unwrapOrThrow(
      await this.commandBus.execute(
        new InviteUserCommand({
          organizationId: params.orgId,
          inviteeEmail: payload.email,
          ttlSeconds: DEFAULT_INVITATION_TTL_SECONDS,
          actorUserId: caller.userId,
        }),
      ),
      { PersistenceUnavailable: serviceUnavailable },
    );
    return { invitationId };
  }
}
