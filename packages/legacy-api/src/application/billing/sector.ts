// The strangler campaign's marker: every file that moves with this module, on both servers.
export const sector = {
  name: "billing",
  owns: [
    "packages/legacy-api/src/application/billing/**",
    "packages/legacy-api/test/application/billing/**",
    "packages/legacy-api/migrations/*_subscriptions.ts",
    "packages/legacy-api/migrations/*_webhook_events.ts",
    "packages/legacy-api/src/lib/backend-client/domains/billing.ts",
    "packages/server/src/modules/billing/**",
  ],
};
