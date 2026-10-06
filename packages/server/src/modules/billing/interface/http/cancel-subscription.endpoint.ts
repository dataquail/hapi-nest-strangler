import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { BillingContract } from "@org/contracts/api/Contracts";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { CancelSubscriptionCommand } from "@/modules/billing/commands/cancel-subscription.command.js";
import { BillingResource } from "@/modules/billing/policies/billing.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import { Authz } from "@/platform/auth/authz.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

import { toSubscriptionResponse } from "./start-subscription.endpoint.js";

const route = BillingContract.PrivateGroup.routes.cancelSubscription;

@Controller()
@UseGuards(UserAuthGuard)
export class CancelSubscriptionEndpoint {
  constructor(
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
    @Inject(Authz) private readonly authz: Authz,
  ) {}

  @Endpoint(route)
  public async cancelSubscription(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<BillingContract.SubscriptionResponse> {
    unwrapOrThrow(
      await this.authz.hasPermissions(caller, BillingResource, Actions.Update, params.orgId),
      {
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    const subscription = unwrapOrThrow(
      await this.commandBus.execute(
        new CancelSubscriptionCommand({ organizationId: params.orgId }),
      ),
      {
        SubscriptionNotFound: (error) =>
          problem(BillingContract.SubscriptionNotFoundError, {
            organizationId: error.organizationId,
            message: `No subscription found for organization ${error.organizationId}`,
          }),
        BillingGatewayUnavailable: (error) =>
          problem(HttpErrors.BadGateway, { message: error.message }),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return toSubscriptionResponse(subscription);
  }
}
