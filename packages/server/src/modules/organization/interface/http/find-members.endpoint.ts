import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { OrganizationResource } from "@/modules/organization/policies/organization.policies.js";
import { FindOrganizationMembershipsQuery } from "@/modules/organization/queries/find-organization-memberships.query.js";
import { Actions } from "@/platform/auth/actions.js";
import { Authz } from "@/platform/auth/authz.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = OrganizationContract.Group.routes.findMembers;

@Controller()
@UseGuards(UserAuthGuard)
export class FindMembersEndpoint {
  constructor(
    @Inject(AppQueryBus) private readonly queryBus: AppQueryBus,
    @Inject(Authz) private readonly authz: Authz,
  ) {}

  @Endpoint(route)
  public async findMembers(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<OrganizationContract.OrganizationMembersResponse> {
    unwrapOrThrow(
      await this.authz.hasPermissions(caller, OrganizationResource, Actions.Read, params.orgId),
      {
        PersistenceUnavailable: serviceUnavailable,
        HttpProblem: () =>
          problem(OrganizationContract.OrganizationNotFoundError, {
            organizationId: params.orgId,
            message: `Organization ${params.orgId} not found`,
          }),
      },
    );
    const members = unwrapOrThrow(
      await this.queryBus.execute(
        new FindOrganizationMembershipsQuery({ organizationId: params.orgId }),
      ),
      { PersistenceUnavailable: serviceUnavailable },
    );
    return {
      members: members.map((m) => ({
        userId: m.userId,
        email: m.email,
        joinedAt: m.joinedAt.toISOString(),
        isAdmin: m.isAdmin,
      })),
    };
  }
}
