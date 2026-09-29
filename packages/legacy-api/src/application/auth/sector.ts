// The strangler campaign's marker: every file that moves with this module, on both servers.
export const sector = {
  name: "auth",
  owns: [
    "packages/legacy-api/src/application/auth/**",
    "packages/legacy-api/test/application/auth/**",
    "packages/legacy-api/src/bin/purge-expired-sessions.ts",
    "packages/legacy-api/test/bin/**",
    "packages/legacy-api/migrations/*_auth_identities.ts",
    "packages/legacy-api/migrations/*_sessions.ts",
    "packages/legacy-api/migrations/*_api_tokens.ts",
    "packages/legacy-api/migrations/*_device_grants.ts",
    "packages/server/src/modules/auth/**",
  ],
};
