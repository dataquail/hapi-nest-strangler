// The platform surface. Billing is a leaf: no peer reaches it, so there is
// no billing.exports.ts.
export { billingCommands, billingCommandSpanAttributes } from "./billing.command-handlers.js";
export { billingEventSpanAttributes } from "./billing.event-span-attributes.js";
export { BillingModule } from "./billing.module.js";
export { billingQueries, billingQuerySpanAttributes } from "./billing.query-handlers.js";
export { BillingGateway } from "./domain/ports/clients/billing-gateway.client.js";
// The one adapter pair a composition root picks: Stripe in production, the
// fake in the test runtime.
export { BillingGatewayFake } from "./infrastructure/clients/billing-gateway.client-fake.js";
export { BillingGatewayLive } from "./infrastructure/clients/billing-gateway.client-live.js";
export { BillingPolicyContribution } from "./policies/billing.policies.js";
export { BillingResolverEntry } from "./policies/billing.resource-resolver.js";
