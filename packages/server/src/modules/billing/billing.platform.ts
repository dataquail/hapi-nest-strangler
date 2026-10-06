export { billingCommands, billingCommandSpanAttributes } from "./billing.command-handlers.js";
export { billingEventSpanAttributes } from "./billing.event-span-attributes.js";
export { BillingModule } from "./billing.module.js";
export { billingQueries, billingQuerySpanAttributes } from "./billing.query-handlers.js";
export { BillingGateway } from "./domain/ports/clients/billing-gateway.client.js";
// The one adapter pair a composition root picks: Stripe, or the in-memory
// stand-in for STRIPE_USE_FAKE and the test runtime.
export { BillingGatewayFake } from "./infrastructure/clients/billing-gateway.client-fake.js";
export { BillingGatewayLive } from "./infrastructure/clients/billing-gateway.client-live.js";
export { BillingPolicyContribution } from "./policies/billing.policies.js";
export { BillingResolverEntry } from "./policies/billing.resource-resolver.js";
