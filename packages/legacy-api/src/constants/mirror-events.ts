// hapi server events the mirror plugin forwards to the Nest server while a
// module is dual-written; a service emits one once its row is written.
export const mirrorEvents = {
  SUBSCRIPTION_STARTED: "mirror-subscription-started",
} as const;
