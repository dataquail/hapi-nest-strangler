import { Body, Controller, Inject, UseGuards } from "@nestjs/common";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { CreateOrganizationCommand } from "@/modules/organization/commands/create-organization.command.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = OrganizationContract.Group.routes.create;

@Controller()
@UseGuards(UserAuthGuard)
export class CreateOrganizationEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async create(
    @Caller() caller: CurrentUser,
    @Body(zodPipe(route.body)) payload: z.infer<typeof route.body>,
  ): Promise<OrganizationContract.CreateOrganizationResponse> {
    const id = unwrapOrThrow(
      await this.commandBus.execute(
        new CreateOrganizationCommand({ name: payload.name, actorUserId: caller.userId }),
      ),
      {
        SuperAdminCannotOwnOrganization: () =>
          problem(OrganizationContract.SuperAdminCannotOwnOrganizationError, {
            message: "Super-admins don't own organizations.",
          }),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return { id };
  }
}
