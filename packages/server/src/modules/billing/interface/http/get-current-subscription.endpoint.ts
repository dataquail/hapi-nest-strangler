import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { BillingContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { BillingResource } from "@/modules/billing/policies/billing.policies.js";
import { FindSubscriptionByOrganizationQuery } from "@/modules/billing/queries/find-subscription-by-organization.query.js";
import { Actions } from "@/platform/auth/actions.js";
import { Authz } from "@/platform/auth/authz.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = BillingContract.PrivateGroup.routes.getCurrentSubscription;

// `read` is the member-or-super-admin gate: every member may see the state.
@Controller()
@UseGuards(UserAuthGuard)
export class GetCurrentSubscriptionEndpoint {
  constructor(
    @Inject(AppQueryBus) private readonly queryBus: AppQueryBus,
    @Inject(Authz) private readonly authz: Authz,
  ) {}

  @Endpoint(route)
  public async getCurrentSubscription(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<BillingContract.SubscriptionResponse> {
    unwrapOrThrow(
      await this.authz.hasPermissions(caller, BillingResource, Actions.Read, params.orgId),
      {
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    const view = unwrapOrThrow(
      await this.queryBus.execute(
        new FindSubscriptionByOrganizationQuery({ organizationId: params.orgId }),
      ),
      { PersistenceUnavailable: serviceUnavailable },
    );
    if (view === null) {
      throw problem(BillingContract.SubscriptionNotFoundError, {
        organizationId: params.orgId,
        message: `No subscription found for organization ${params.orgId}`,
      });
    }
    return {
      id: view.id,
      organizationId: view.organizationId,
      status: view.status,
      currentPeriodEnd: view.currentPeriodEnd === null ? null : view.currentPeriodEnd.toISOString(),
    };
  }
}
