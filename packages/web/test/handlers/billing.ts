import { BillingContract } from "@org/contracts/api/Contracts";
import * as HttpErrors from "@org/contracts/HttpErrors";

import { BILLING_ORG_ID, makeSubscription } from "../fixtures/billing";
import { fail, ok, typedHandler } from "../typed-handler";

const routes = BillingContract.PrivateGroup.routes;

const notFound = () =>
  fail(BillingContract.SubscriptionNotFoundError, {
    organizationId: BILLING_ORG_ID,
    message: "No subscription for this organization.",
  });

export const billingHandlers = {
  /** GET current; pass `null` for the "never subscribed" 404. */
  current: (subscription: BillingContract.SubscriptionResponse | null = makeSubscription()) =>
    typedHandler(routes.getCurrentSubscription, () =>
      subscription === null ? notFound() : ok(subscription),
    ),

  start: (
    outcome: { readonly result: "success" | "BadGateway" | "SubscriptionAlreadyExistsError" } = {
      result: "success",
    },
  ) =>
    typedHandler(routes.startSubscription, () => {
      if (outcome.result === "BadGateway")
        return fail(HttpErrors.BadGateway, { message: "Stripe is unreachable." });
      if (outcome.result === "SubscriptionAlreadyExistsError") {
        return fail(BillingContract.SubscriptionAlreadyExistsError, {
          organizationId: BILLING_ORG_ID,
          message: "This organization already has a subscription.",
        });
      }
      return ok(makeSubscription());
    }),

  cancel: (
    outcome: { readonly result: "success" | "SubscriptionNotFoundError" } = { result: "success" },
  ) =>
    typedHandler(routes.cancelSubscription, () =>
      outcome.result === "success" ? ok(makeSubscription({ status: "canceled" })) : notFound(),
    ),
};
