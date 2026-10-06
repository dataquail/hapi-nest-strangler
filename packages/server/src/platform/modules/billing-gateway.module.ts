import { Global, Module } from "@nestjs/common";

import { EnvVars } from "@/common/env-vars.js";
import {
  BillingGateway,
  BillingGatewayFake,
  BillingGatewayLive,
} from "@/modules/billing/billing.platform.js";

// The one adapter whose choice belongs to the composition root: Stripe, or the
// in-memory stand-in on STRIPE_USE_FAKE; the test server overrides it with a
// fake it can inspect. Global so the billing module need not name it.
@Global()
@Module({
  providers: [
    {
      provide: BillingGateway,
      inject: [EnvVars],
      useFactory: (env: EnvVars) => {
        if (env.STRIPE_USE_FAKE) return new BillingGatewayFake();
        const missing = [
          ["STRIPE_SECRET_KEY", env.STRIPE_SECRET_KEY],
          ["STRIPE_WEBHOOK_SECRET", env.STRIPE_WEBHOOK_SECRET],
          ["STRIPE_PRICE_ID_DEFAULT", env.STRIPE_PRICE_ID_DEFAULT],
        ].flatMap(([name, value]) => (value === "" ? [name] : []));
        if (missing.length > 0) {
          throw new Error(
            `The Stripe gateway needs ${missing.join(", ")}, or STRIPE_USE_FAKE=true`,
          );
        }
        return new BillingGatewayLive(env);
      },
    },
  ],
  exports: [BillingGateway],
})
export class BillingGatewayModule {}
