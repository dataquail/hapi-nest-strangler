import { Body, Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { BillingContract } from "@org/contracts/api/Contracts";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { StartSubscriptionCommand } from "@/modules/billing/commands/start-subscription.command.js";
import type { SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { BillingResource } from "@/modules/billing/policies/billing.policies.js";
import { Actions } from "@/platform/auth/actions.js";
import { Authz } from "@/platform/auth/authz.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = BillingContract.PrivateGroup.routes.startSubscription;

export const toSubscriptionResponse = (
  subscription: SubscriptionRoot,
): BillingContract.SubscriptionResponse => ({
  id: subscription.id,
  organizationId: subscription.organizationId,
  status: subscription.status,
  currentPeriodEnd:
    subscription.currentPeriodEnd === null ? null : subscription.currentPeriodEnd.toISOString(),
});

// `update` covers both subscribe and cancel; the verb-level difference is the HTTP method.
@Controller()
@UseGuards(UserAuthGuard)
export class StartSubscriptionEndpoint {
  constructor(
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
    @Inject(Authz) private readonly authz: Authz,
  ) {}

  @Endpoint(route)
  public async startSubscription(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
    @Body(zodPipe(route.body)) _payload: z.infer<typeof route.body>,
  ): Promise<BillingContract.SubscriptionResponse> {
    unwrapOrThrow(
      await this.authz.hasPermissions(caller, BillingResource, Actions.Update, params.orgId),
      {
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    const subscription = unwrapOrThrow(
      await this.commandBus.execute(new StartSubscriptionCommand({ organizationId: params.orgId })),
      {
        SubscriptionAlreadyExistsForOrganization: (error) =>
          problem(BillingContract.SubscriptionAlreadyExistsError, {
            organizationId: error.organizationId,
            message: `An active subscription already exists for organization ${error.organizationId}`,
          }),
        BillingGatewayUnavailable: (error) =>
          problem(HttpErrors.BadGateway, { message: error.message }),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return toSubscriptionResponse(subscription);
  }
}
