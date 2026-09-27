import { Global, Module } from "@nestjs/common";

import { BillingGateway, BillingGatewayLive } from "@/modules/billing/billing.platform.js";

// The one adapter whose choice belongs to the composition root: Stripe here,
// the fake in the test server. Global so the billing module need not name it.
@Global()
@Module({
  providers: [{ provide: BillingGateway, useClass: BillingGatewayLive }],
  exports: [BillingGateway],
})
export class BillingGatewayModule {}
