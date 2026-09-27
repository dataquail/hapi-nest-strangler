import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { AcceptInvitationCommand } from "@/modules/organization/commands/accept-invitation.command.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = OrganizationContract.InvitationGroup.routes.accept;

@Controller()
@UseGuards(UserAuthGuard)
export class AcceptInvitationEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async accept(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<OrganizationContract.AcceptInvitationResponse> {
    const organizationId = unwrapOrThrow(
      await this.commandBus.execute(
        new AcceptInvitationCommand({ token: params.token, userId: caller.userId }),
      ),
      {
        InvitationTokenNotFound: () =>
          problem(OrganizationContract.InvitationNotFoundError, {
            message: "Invitation not found",
          }),
        InvitationAlreadyAccepted: () =>
          problem(OrganizationContract.InvitationGoneError, {
            reason: "accepted",
            message: "This invitation has already been accepted.",
          }),
        InvitationRevoked: () =>
          problem(OrganizationContract.InvitationGoneError, {
            reason: "revoked",
            message: "This invitation has been revoked.",
          }),
        InvitationExpired: () =>
          problem(OrganizationContract.InvitationGoneError, {
            reason: "expired",
            message: "This invitation has expired.",
          }),
        SuperAdminCannotOwnOrganization: () =>
          problem(OrganizationContract.SuperAdminCannotOwnOrganizationError, {
            message: "Super-admins don't join organizations.",
          }),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return { organizationId };
  }
}
