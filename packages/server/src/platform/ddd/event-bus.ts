import type { EventBus } from "@org/event-bus";

// The application's name for the event bus, and its DI token. One level outside
// contracts/ on purpose: that placement is what keeps a bus out of a domain
// port's reach.
export interface DomainEventBus extends EventBus {}
export abstract class DomainEventBus {}
